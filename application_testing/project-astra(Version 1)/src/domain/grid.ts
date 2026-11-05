import type { DataClass, LonLat } from '../types';
import { DEG, M_PER_DEG } from './mars';

/**
 * Regular longitude/latitude elevation grid (equirectangular, Mars 2000 sphere).
 * Row 0 is the NORTH edge. NaN marks no-data.
 */
export interface TerrainGrid {
  id: string;
  source: 'simulated' | 'dem';
  dataClass: DataClass;
  label: string;
  west: number;
  south: number;
  east: number;
  north: number;
  cols: number;
  rows: number;
  dLon: number;
  dLat: number;
  elev: Float32Array;
  /** Nominal ground sampling in metres (documentation only). */
  resolutionM: number;
  provenance: string;
  limitations: string[];
}

export interface Cell {
  col: number;
  row: number;
}

export function idx(g: TerrainGrid, col: number, row: number): number {
  return row * g.cols + col;
}

export function inGrid(g: TerrainGrid, p: LonLat): boolean {
  return p.lon >= g.west && p.lon < g.east && p.lat > g.south && p.lat <= g.north;
}

export function cellOf(g: TerrainGrid, p: LonLat): Cell | null {
  if (!inGrid(g, p)) return null;
  const col = Math.min(g.cols - 1, Math.floor((p.lon - g.west) / g.dLon));
  const row = Math.min(g.rows - 1, Math.floor((g.north - p.lat) / g.dLat));
  return { col, row };
}

export function lonLatOf(g: TerrainGrid, col: number, row: number): LonLat {
  return { lon: g.west + (col + 0.5) * g.dLon, lat: g.north - (row + 0.5) * g.dLat };
}

/** East-west and north-south cell sizes (metres) at a given row. */
export function cellSizeM(g: TerrainGrid, row: number): { dx: number; dy: number } {
  const lat = g.north - (row + 0.5) * g.dLat;
  return { dx: g.dLon * M_PER_DEG * Math.cos(lat * DEG), dy: g.dLat * M_PER_DEG };
}

export function elevationAt(g: TerrainGrid, col: number, row: number): number {
  return g.elev[row * g.cols + col];
}

/**
 * Slope in degrees using Horn's method (3x3 weighted finite differences), the same formulation used by
 * common GIS tools. Edge cells replicate their nearest neighbour. Any no-data neighbour yields NaN.
 * DERIVED from the elevation grid; only meaningful at the grid's resolution.
 */
export function computeSlopeDeg(g: TerrainGrid): Float32Array {
  const { cols, rows, elev } = g;
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const { dx, dy } = cellSizeM(g, r);
    const rN = Math.max(0, r - 1);
    const rS = Math.min(rows - 1, r + 1);
    for (let c = 0; c < cols; c++) {
      const cW = Math.max(0, c - 1);
      const cE = Math.min(cols - 1, c + 1);
      const z1 = elev[rN * cols + cW];
      const z2 = elev[rN * cols + c];
      const z3 = elev[rN * cols + cE];
      const z4 = elev[r * cols + cW];
      const z6 = elev[r * cols + cE];
      const z7 = elev[rS * cols + cW];
      const z8 = elev[rS * cols + c];
      const z9 = elev[rS * cols + cE];
      const z5 = elev[r * cols + c];
      const sum = z1 + z2 + z3 + z4 + z5 + z6 + z7 + z8 + z9;
      if (Number.isNaN(sum)) {
        out[r * cols + c] = NaN;
        continue;
      }
      const spanX = (cE - cW) || 1;
      const spanY = (rS - rN) || 1;
      // Horn weights assume a span of 2 cells; rescale at edges where the span is 1.
      const dzdx = (z3 + 2 * z6 + z9 - (z1 + 2 * z4 + z7)) / (4 * spanX * dx);
      const dzdy = (z1 + 2 * z2 + z3 - (z7 + 2 * z8 + z9)) / (4 * spanY * dy);
      out[r * cols + c] = Math.atan(Math.hypot(dzdx, dzdy)) / DEG;
    }
  }
  return out;
}

export interface GridStats {
  minElev: number;
  maxElev: number;
  meanSlope: number;
  maxSlope: number;
  nodataCells: number;
  histogram: { binStart: number; binEnd: number; count: number }[];
}

export function gridStats(g: TerrainGrid, slope: Float32Array, binDeg = 5, maxDeg = 40): GridStats {
  let minE = Infinity;
  let maxE = -Infinity;
  let sumS = 0;
  let nS = 0;
  let maxS = 0;
  let nodata = 0;
  const bins = Math.ceil(maxDeg / binDeg);
  const counts = new Array<number>(bins).fill(0);
  for (let i = 0; i < g.elev.length; i++) {
    const e = g.elev[i];
    if (Number.isNaN(e)) {
      nodata++;
      continue;
    }
    if (e < minE) minE = e;
    if (e > maxE) maxE = e;
    const s = slope[i];
    if (!Number.isNaN(s)) {
      sumS += s;
      nS++;
      if (s > maxS) maxS = s;
      counts[Math.min(bins - 1, Math.floor(s / binDeg))]++;
    }
  }
  return {
    minElev: minE,
    maxElev: maxE,
    meanSlope: nS ? sumS / nS : NaN,
    maxSlope: maxS,
    nodataCells: nodata,
    histogram: counts.map((count, i) => ({
      binStart: i * binDeg,
      binEnd: (i + 1) * binDeg,
      count,
    })),
  };
}
