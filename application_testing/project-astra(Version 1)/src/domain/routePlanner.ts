import type { Direction, LonLat, MobilityProfile, Strategy, Waypoint } from '../types';
import { cellOf, cellSizeM, lonLatOf, type TerrainGrid } from './grid';
import {
  SCIENCE_BONUS,
  SCIENCE_RADIUS_M,
  STRATEGIES,
  STRATEGY_INFO,
  edgeSlopeDeg,
  terrainPenalty,
} from './costModel';
import { buildScienceField, findPath } from './router';
import { formatLonLat, haversineM } from './mars';

export interface ScienceTarget {
  id: string;
  name: string;
  location: LonLat;
}

export interface PlanInput {
  start: LonLat;
  destination: LonLat;
  waypoints: Waypoint[];
  /** null => return to the start point. */
  returnPoint: LonLat | null;
  profile: MobilityProfile;
  /** Targets that attract the science-focused strategy (selected POIs and user stops). */
  scienceTargets: ScienceTarget[];
}

export interface RouteMetrics {
  distanceM: number;
  length3dM: number;
  gainM: number;
  lossM: number;
  maxSlopeDeg: number;
  meanSlopeDeg: number;
  /** Extra effort over flat ground under the model, in percent (relative index, not a safety measure). */
  terrainBurdenPct: number;
  cellCount: number;
  nodataCellsCrossed: number;
  scienceNear: { id: string; name: string; distanceM: number }[];
}

export interface RouteSegment {
  fromName: string;
  toName: string;
  distanceM: number;
  gainM: number;
  lossM: number;
  maxSlopeDeg: number;
}

export interface ProfilePoint {
  distM: number;
  elev: number;
  slopeDeg: number;
}

export interface RouteResult {
  id: string;
  strategy: Strategy;
  direction: Direction;
  label: string;
  found: boolean;
  error?: string;
  coordinates: LonLat[];
  cells: number[];
  metrics: RouteMetrics | null;
  segments: RouteSegment[];
  profile: ProfilePoint[];
  explanation: string[];
  warnings: string[];
  simulated: boolean;
  /** Total cost under the strategy's own cost function (arbitrary units: metres-equivalent). */
  modelCost: number;
}

export interface PlanBundle {
  outbound: Record<Strategy, RouteResult>;
  returns: Record<Strategy, RouteResult>;
  /** Outbound path walked backwards, evaluated with return-direction costs. Null if the return point differs from the start. */
  retrace: Record<Strategy, RouteResult | null>;
  gridId: string;
  computedAt: number;
}

interface NamedPoint {
  name: string;
  location: LonLat;
}

const NEAR_RADIUS_M = SCIENCE_RADIUS_M;

function failure(
  id: string,
  strategy: Strategy,
  direction: Direction,
  label: string,
  error: string,
  simulated: boolean,
): RouteResult {
  return {
    id,
    strategy,
    direction,
    label,
    found: false,
    error,
    coordinates: [],
    cells: [],
    metrics: null,
    segments: [],
    profile: [],
    explanation: [],
    warnings: [],
    simulated,
    modelCost: Infinity,
  };
}

/** Evaluates a cell path (any direction) and builds metrics, segments and the elevation profile. */
export function evaluatePath(
  grid: TerrainGrid,
  cells: number[],
  legEnds: number[],
  names: string[],
  profile: MobilityProfile,
  targets: ScienceTarget[],
): { metrics: RouteMetrics; segments: RouteSegment[]; profile: ProfilePoint[] } {
  const { cols, elev } = grid;
  const dy = cellSizeM(grid, 0).dy;
  const prof: ProfilePoint[] = [{ distM: 0, elev: elev[cells[0]], slopeDeg: 0 }];
  let dist = 0;
  let len3d = 0;
  let gain = 0;
  let loss = 0;
  let maxSlope = 0;
  let slopeDist = 0;
  let penDist = 0;
  let nodata = 0;

  const segs: RouteSegment[] = names.slice(0, -1).map((n, i) => ({
    fromName: n,
    toName: names[i + 1],
    distanceM: 0,
    gainM: 0,
    lossM: 0,
    maxSlopeDeg: 0,
  }));
  let leg = 0;

  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1];
    const b = cells[i];
    const ca = a % cols;
    const ra = (a - ca) / cols;
    const cb = b % cols;
    const rb = (b - cb) / cols;
    const dxAvg = (cellSizeM(grid, ra).dx + cellSizeM(grid, rb).dx) / 2;
    const d = Math.hypot((cb - ca) * dxAvg, (rb - ra) * dy);
    const za = elev[a];
    const zb = elev[b];
    if (Number.isNaN(zb)) nodata++;
    const dz = zb - za;
    const slope = edgeSlopeDeg(d, dz);
    dist += d;
    len3d += Math.hypot(d, dz);
    if (dz > 0) gain += dz;
    else loss -= dz;
    if (slope > maxSlope) maxSlope = slope;
    slopeDist += slope * d;
    penDist += terrainPenalty(d, dz, profile) * d;
    prof.push({ distM: dist, elev: zb, slopeDeg: slope });

    while (leg < legEnds.length - 1 && i > legEnds[leg]) leg++;
    const s = segs[Math.min(leg, segs.length - 1)];
    if (s) {
      s.distanceM += d;
      if (dz > 0) s.gainM += dz;
      else s.lossM -= dz;
      if (slope > s.maxSlopeDeg) s.maxSlopeDeg = slope;
    }
  }

  const pathLL = cells.map((c) => lonLatOf(grid, c % cols, Math.floor(c / cols)));
  const scienceNear = targets
    .map((t) => ({
      id: t.id,
      name: t.name,
      distanceM: Math.min(...pathLL.map((p) => haversineM(p, t.location))),
    }))
    .filter((t) => t.distanceM <= NEAR_RADIUS_M)
    .sort((x, y) => x.distanceM - y.distanceM);

  return {
    metrics: {
      distanceM: dist,
      length3dM: len3d,
      gainM: gain,
      lossM: loss,
      maxSlopeDeg: maxSlope,
      meanSlopeDeg: dist > 0 ? slopeDist / dist : 0,
      terrainBurdenPct: dist > 0 ? ((profile.terrainWeight * penDist) / dist) * 100 : 0,
      cellCount: cells.length,
      nodataCellsCrossed: nodata,
      scienceNear,
    },
    segments: segs,
    profile: prof,
  };
}

function describeStrategy(strategy: Strategy, profile: MobilityProfile, nTargets: number): string[] {
  const lim = `Edges steeper than ${profile.maxSlopeDeg}° (profile "${profile.name}") are treated as impassable; no-data cells are never crossed.`;
  if (strategy === 'shortest') {
    return [
      'Strategy: Shortest. Minimises planar distance with A* over an 8-connected grid.',
      'Cost per edge = distance (no terrain weighting).',
      lim,
    ];
  }
  const base = [
    `Cost per edge = distance × (1 + ${profile.terrainWeight} × penalty), penalty = (edge slope / ${profile.maxSlopeDeg}°)² + ${profile.uphillWeight} × uphill grade.`,
    'Costs are directed: climbing costs more than descending the same edge, so return legs can differ from outbound legs.',
    lim,
  ];
  if (strategy === 'terrain') return ['Strategy: Terrain-conscious. Steep ground and climbing are penalised.', ...base];
  return [
    'Strategy: Science-focused. Terrain-conscious cost with a bounded discount near selected science targets.',
    ...base,
    nTargets > 0
      ? `Within ${SCIENCE_RADIUS_M} m of ${nTargets} target(s), edge cost is multiplied by as little as ${(1 - SCIENCE_BONUS).toFixed(2)}, which pulls the route toward them without forcing it through them.`
      : 'No science targets are selected, so this route equals the terrain-conscious route.',
  ];
}

function computeRoute(
  grid: TerrainGrid,
  pts: NamedPoint[],
  profile: MobilityProfile,
  strategy: Strategy,
  direction: Direction,
  targets: ScienceTarget[],
): RouteResult {
  const simulated = grid.source === 'simulated';
  const id = `${direction}-${strategy}`;
  const label = `${STRATEGY_INFO[strategy].name} (${direction})`;

  const cellIdx: number[] = [];
  for (const p of pts) {
    const cell = cellOf(grid, p.location);
    if (!cell) {
      return failure(id, strategy, direction, label, `${p.name} (${formatLonLat(p.location, 3)}) is outside the terrain grid coverage.`, simulated);
    }
    const i = cell.row * grid.cols + cell.col;
    if (Number.isNaN(grid.elev[i])) {
      return failure(id, strategy, direction, label, `${p.name} falls on a no-data cell of the terrain grid.`, simulated);
    }
    cellIdx.push(i);
  }

  const field =
    strategy === 'science'
      ? buildScienceField(
          grid,
          targets.map((t) => t.location),
          SCIENCE_RADIUS_M,
          SCIENCE_BONUS,
        )
      : null;
  const minMult = field ? 1 - SCIENCE_BONUS : 1;

  const all: number[] = [];
  const legEnds: number[] = [];
  let cost = 0;
  for (let k = 0; k < cellIdx.length - 1; k++) {
    const res = findPath(grid, cellIdx[k], cellIdx[k + 1], profile, strategy, field, minMult);
    if (!res.found) {
      return failure(
        id,
        strategy,
        direction,
        label,
        `No route exists between "${pts[k].name}" and "${pts[k + 1].name}" under the ${profile.maxSlopeDeg}° slope limit. Raise the limit or move a point.`,
        simulated,
      );
    }
    cost += res.cost;
    for (let j = all.length === 0 ? 0 : 1; j < res.cells.length; j++) all.push(res.cells[j]);
    legEnds.push(all.length - 1);
  }

  const ev = evaluatePath(grid, all, legEnds, pts.map((p) => p.name), profile, targets);
  const coords = all.map((c) => lonLatOf(grid, c % grid.cols, Math.floor(c / grid.cols)));
  coords[0] = pts[0].location;
  coords[coords.length - 1] = pts[pts.length - 1].location;

  const warnings: string[] = [];
  if (simulated) {
    warnings.push('Computed on SIMULATED demonstration terrain. This is not real Jezero topography.');
  } else {
    warnings.push(
      `Derived from a ${grid.resolutionM} m elevation grid. Rocks, small craters and soft ground below that scale are not represented.`,
    );
  }

  return {
    id,
    strategy,
    direction,
    label,
    found: true,
    coordinates: coords,
    cells: all,
    metrics: ev.metrics,
    segments: ev.segments,
    profile: ev.profile,
    explanation: describeStrategy(strategy, profile, strategy === 'science' ? targets.length : 0),
    warnings,
    simulated,
    modelCost: cost,
  };
}

function retraceRoute(
  grid: TerrainGrid,
  outbound: RouteResult,
  profile: MobilityProfile,
  targets: ScienceTarget[],
  startName: string,
  endName: string,
): RouteResult {
  const cells = [...outbound.cells].reverse();
  const ev = evaluatePath(grid, cells, [cells.length - 1], [endName, startName], profile, targets);
  const coords = [...outbound.coordinates].reverse();
  return {
    ...outbound,
    id: `retrace-${outbound.strategy}`,
    direction: 'return',
    label: `Outbound path retraced (${STRATEGY_INFO[outbound.strategy].name})`,
    cells,
    coordinates: coords,
    metrics: ev.metrics,
    segments: ev.segments,
    profile: ev.profile,
    explanation: [
      'The outbound path walked in reverse, evaluated with the same directed cost model.',
      'Compare it with the optimised return route to see how much the reversed climb/descent changes the effort.',
    ],
  };
}

export function planAll(grid: TerrainGrid, input: PlanInput): PlanBundle {
  const outbound = {} as Record<Strategy, RouteResult>;
  const returns = {} as Record<Strategy, RouteResult>;
  const retrace = {} as Record<Strategy, RouteResult | null>;

  const outPts: NamedPoint[] = [
    { name: 'Start', location: input.start },
    ...input.waypoints.map((w) => ({ name: w.name, location: w.location })),
    { name: 'Destination', location: input.destination },
  ];
  const retPoint = input.returnPoint ?? input.start;
  const retPts: NamedPoint[] = [
    { name: 'Destination', location: input.destination },
    { name: input.returnPoint ? 'Return point' : 'Start (return)', location: retPoint },
  ];
  const sameAsStart = haversineM(retPoint, input.start) < 1;

  for (const s of STRATEGIES) {
    outbound[s] = computeRoute(grid, outPts, input.profile, s, 'outbound', input.scienceTargets);
    returns[s] = computeRoute(grid, retPts, input.profile, s, 'return', input.scienceTargets);
    retrace[s] =
      sameAsStart && outbound[s].found
        ? retraceRoute(grid, outbound[s], input.profile, input.scienceTargets, 'Start', 'Destination')
        : null;
  }

  for (const dir of [outbound, returns]) {
    const base = dir.shortest;
    for (const s of ['terrain', 'science'] as Strategy[]) {
      const r = dir[s];
      if (base.found && r.found && base.metrics && r.metrics && base.metrics.distanceM > 0) {
        const dd = ((r.metrics.distanceM - base.metrics.distanceM) / base.metrics.distanceM) * 100;
        r.explanation.push(
          `Versus the shortest route: ${dd >= 0 ? '+' : ''}${dd.toFixed(1)}% distance, terrain burden ${r.metrics.terrainBurdenPct.toFixed(1)}% vs ${base.metrics.terrainBurdenPct.toFixed(1)}%, steepest edge ${r.metrics.maxSlopeDeg.toFixed(1)}° vs ${base.metrics.maxSlopeDeg.toFixed(1)}°.`,
        );
      }
    }
  }

  return { outbound, returns, retrace, gridId: grid.id, computedAt: Date.now() };
}
