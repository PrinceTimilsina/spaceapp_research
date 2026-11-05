import { describe, expect, it } from 'vitest';
import { DEG, M_PER_DEG, MARS_RADIUS_M, fromLocalM, haversineM, toLocalM } from './mars';
import { cellOf, cellSizeM, computeSlopeDeg, lonLatOf, type TerrainGrid } from './grid';
import { PROFILES, SCIENCE_BONUS, SCIENCE_RADIUS_M, edgeSlopeDeg, stepCost } from './costModel';
import { buildScienceField, findPath } from './router';
import { evaluatePath, planAll, type PlanInput } from './routePlanner';
import { generateSimulatedTerrain } from './simTerrain';
import { buildGridFromDem, validateDemMeta, type DemMeta } from './demLoader';

/** Flat test grid centred on the equator-ish so cell sizes are easy to reason about. */
function makeGrid(cols: number, rows: number, fn: (c: number, r: number) => number): TerrainGrid {
  const dLat = 100 / M_PER_DEG; // 100 m
  const dLon = dLat / Math.cos(18.4 * DEG);
  const elev = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) elev[r * cols + c] = fn(c, r);
  return {
    id: 'test',
    source: 'simulated',
    dataClass: 'SIMULATED',
    label: 'test',
    west: 77,
    south: 18.4 - rows * dLat,
    east: 77 + cols * dLon,
    north: 18.4,
    cols,
    rows,
    dLon,
    dLat,
    elev,
    resolutionM: 100,
    provenance: 'test',
    limitations: [],
  };
}

const standard = PROFILES.find((p) => p.id === 'standard')!;

describe('Mars geometry', () => {
  it('uses the Mars 2000 sphere radius, not Earth', () => {
    expect(MARS_RADIUS_M).toBe(3396190);
    // 1 degree of latitude on Mars is ~59.27 km (Earth: ~111.2 km)
    const d = haversineM({ lon: 77, lat: 18 }, { lon: 77, lat: 19 });
    expect(d).toBeGreaterThan(59000);
    expect(d).toBeLessThan(59500);
    expect(d).toBeCloseTo(M_PER_DEG, 0);
  });

  it('round-trips local metre offsets', () => {
    const o = { lon: 77.5, lat: 18.4 };
    const p = fromLocalM(o, 1234, -987);
    const back = toLocalM(o, p);
    expect(back.x).toBeCloseTo(1234, 6);
    expect(back.y).toBeCloseTo(-987, 6);
  });
});

describe('slope (Horn)', () => {
  it('recovers a known planar tilt', () => {
    // 10 degree slope rising to the east: dz per column = tan(10°) * dx
    const g0 = makeGrid(20, 20, () => 0);
    const { dx } = cellSizeM(g0, 10);
    const g = makeGrid(20, 20, (c) => Math.tan(10 * DEG) * dx * c);
    const s = computeSlopeDeg(g);
    expect(s[10 * 20 + 10]).toBeCloseTo(10, 1);
  });

  it('is NaN next to no-data', () => {
    const g = makeGrid(5, 5, (c, r) => (c === 2 && r === 2 ? NaN : 1));
    const s = computeSlopeDeg(g);
    expect(Number.isNaN(s[2 * 5 + 2])).toBe(true);
    expect(Number.isNaN(s[2 * 5 + 3])).toBe(true);
    expect(Number.isNaN(s[0])).toBe(false);
  });
});

describe('cost model', () => {
  it('blocks edges above the hard limit and charges uphill more than downhill', () => {
    expect(stepCost(100, 100, standard, 'terrain')).toBe(Infinity); // ~45°
    const up = stepCost(100, 10, standard, 'terrain');
    const down = stepCost(100, -10, standard, 'terrain');
    expect(up).toBeGreaterThan(down);
    expect(down).toBeGreaterThan(100); // still costs more than flat ground
  });

  it('shortest ignores terrain weighting', () => {
    expect(stepCost(100, 10, standard, 'shortest')).toBeCloseTo(100, 9);
    expect(edgeSlopeDeg(100, 10)).toBeCloseTo(5.71, 1);
  });
});

describe('A* router', () => {
  it('finds a straight path on flat ground with correct cost', () => {
    const g = makeGrid(30, 5, () => 0);
    const res = findPath(g, 2 * 30 + 0, 2 * 30 + 20, standard, 'shortest', null);
    expect(res.found).toBe(true);
    expect(res.cells.length).toBe(21);
    const dx = cellSizeM(g, 2).dx;
    expect(res.cost).toBeCloseTo(20 * dx, 3);
  });

  it('refuses to cross a wall steeper than the limit and reports failure', () => {
    const g = makeGrid(20, 9, (c) => (c >= 10 ? 500 : 0));
    const res = findPath(g, 4 * 20 + 2, 4 * 20 + 17, standard, 'shortest', null);
    expect(res.found).toBe(false);
  });

  it('terrain strategy detours through a gap that shortest ignores when both are passable', () => {
    // A ridge (passable 15° slopes) with a flat gap at the top rows.
    const g0 = makeGrid(40, 21, () => 0);
    const { dx } = cellSizeM(g0, 10);
    const rise = Math.tan(15 * DEG) * dx; // per-column rise at 15°
    const g = makeGrid(40, 21, (c, r) => {
      if (r <= 1) return 0; // flat gap in the north
      if (c >= 18 && c < 22) return (c - 17) * rise;
      if (c >= 22) return 4 * rise - (c - 21) * rise < 0 ? 0 : 4 * rise - (c - 21) * rise;
      return 0;
    });
    const start = 10 * 40 + 2;
    const goal = 10 * 40 + 37;
    const short = findPath(g, start, goal, standard, 'shortest', null);
    const terr = findPath(g, start, goal, standard, 'terrain', null);
    expect(short.found && terr.found).toBe(true);
    const ev = (cells: number[]) => evaluatePath(g, cells, [cells.length - 1], ['a', 'b'], standard, []).metrics;
    const ms = ev(short.cells);
    const mt = ev(terr.cells);
    expect(mt.distanceM).toBeGreaterThanOrEqual(ms.distanceM);
    expect(mt.terrainBurdenPct).toBeLessThan(ms.terrainBurdenPct);
  });

  it('directed costs make the return leg differ when the ground is tilted', () => {
    const g0 = makeGrid(30, 5, () => 0);
    const { dx } = cellSizeM(g0, 2);
    const g = makeGrid(30, 5, (c) => Math.tan(8 * DEG) * dx * c);
    const a = 2 * 30 + 1;
    const b = 2 * 30 + 28;
    const out = findPath(g, a, b, standard, 'terrain', null);
    const back = findPath(g, b, a, standard, 'terrain', null);
    expect(out.cost).toBeGreaterThan(back.cost);
  });

  it('science field pulls the science route toward a target without exceeding the discount floor', () => {
    const g = makeGrid(120, 81, () => 0);
    const target = lonLatOf(g, 60, 28);
    const field = buildScienceField(g, [target], SCIENCE_RADIUS_M, SCIENCE_BONUS)!;
    expect(Math.min(...field)).toBeGreaterThanOrEqual(1 - SCIENCE_BONUS - 1e-6);
    const start = 40 * 120 + 2;
    const goal = 40 * 120 + 117;
    const plain = findPath(g, start, goal, standard, 'terrain', null);
    const sci = findPath(g, start, goal, standard, 'science', field, 1 - SCIENCE_BONUS);
    const minRow = (cells: number[]) => Math.min(...cells.map((c) => Math.floor(c / 120)));
    expect(minRow(sci.cells)).toBeLessThan(minRow(plain.cells));
  });
});

describe('planAll on simulated terrain', () => {
  const grid = generateSimulatedTerrain();
  const input: PlanInput = {
    start: lonLatOf(grid, 40, 300),
    destination: lonLatOf(grid, 360, 60),
    waypoints: [],
    returnPoint: null,
    profile: standard,
    scienceTargets: [],
  };
  const bundle = planAll(grid, input);

  it('is labelled SIMULATED and produces routes for every strategy', () => {
    expect(grid.dataClass).toBe('SIMULATED');
    for (const s of ['shortest', 'terrain', 'science'] as const) {
      expect(bundle.outbound[s].found).toBe(true);
      expect(bundle.outbound[s].simulated).toBe(true);
      expect(bundle.outbound[s].warnings.join(' ')).toMatch(/SIMULATED/);
      expect(bundle.returns[s].found).toBe(true);
    }
  });

  it('terrain-conscious route has no more terrain burden than the shortest route', () => {
    const s = bundle.outbound.shortest.metrics!;
    const t = bundle.outbound.terrain.metrics!;
    expect(t.terrainBurdenPct).toBeLessThanOrEqual(s.terrainBurdenPct + 1e-6);
    expect(t.distanceM).toBeGreaterThanOrEqual(s.distanceM - 1e-6);
  });

  it('retrace is available when returning to start and covers the same distance', () => {
    const r = bundle.retrace.terrain!;
    expect(r).not.toBeNull();
    expect(r.metrics!.distanceM).toBeCloseTo(bundle.outbound.terrain.metrics!.distanceM, 3);
  });

  it('reports points outside coverage instead of guessing', () => {
    const bad = planAll(grid, { ...input, start: { lon: 10, lat: 10 } });
    expect(bad.outbound.shortest.found).toBe(false);
    expect(bad.outbound.shortest.error).toMatch(/outside the terrain grid/);
  });

  it('routes through user waypoints in order', () => {
    const wp = lonLatOf(grid, 200, 200);
    const b = planAll(grid, {
      ...input,
      waypoints: [{ id: 'w1', name: 'Stop A', location: wp, origin: 'user' }],
    });
    expect(b.outbound.terrain.found).toBe(true);
    expect(b.outbound.terrain.segments.length).toBe(2);
    expect(b.outbound.terrain.segments[0].toName).toBe('Stop A');
    expect(cellOf(grid, wp)).not.toBeNull();
  });
});

describe('DEM loader', () => {
  const meta: DemMeta = {
    schema: 1,
    name: 'Test DEM',
    productId: 'TEST',
    provider: 'unit test',
    sourceUrl: 'https://example.invalid',
    bounds: { west: 77, south: 18, east: 77.01, north: 18.01 },
    cols: 3,
    rows: 2,
    cellSizeM: 20,
    elevationUnits: 'm',
    nodata: -9999,
    verticalDatum: 'test',
    processing: 'test',
    acquisition: 'n/a',
    license: 'test',
    limitations: [],
    file: 'dem.f32',
  };

  it('builds a DERIVED grid and maps nodata to NaN', () => {
    const buf = new Float32Array([1, 2, 3, 4, -9999, 6]).buffer;
    const g = buildGridFromDem(validateDemMeta(meta), buf);
    expect(g.dataClass).toBe('DERIVED');
    expect(g.source).toBe('dem');
    expect(Number.isNaN(g.elev[4])).toBe(true);
    expect(g.elev[5]).toBe(6);
  });

  it('rejects a binary of the wrong size and incomplete metadata', () => {
    expect(() => buildGridFromDem(meta, new ArrayBuffer(8))).toThrow(/expected/);
    expect(() => validateDemMeta({ ...meta, productId: '' })).toThrow();
    expect(() => validateDemMeta({ ...meta, bounds: { west: 1, south: 1, east: 0, north: 2 } })).toThrow();
  });
});
