import type { LonLat, MobilityProfile, Strategy } from '../types';
import { cellSizeM, type TerrainGrid } from './grid';
import { stepCost } from './costModel';

/** Minimal binary min-heap keyed by priority, with lazy deletion handled by the caller. */
class MinHeap {
  private nodes: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.nodes.length;
  }
  push(node: number, key: number): void {
    const n = this.nodes;
    const k = this.keys;
    let i = n.length;
    n.push(node);
    k.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [n[p], n[i]] = [n[i], n[p]];
      [k[p], k[i]] = [k[i], k[p]];
      i = p;
    }
  }
  pop(): number {
    const n = this.nodes;
    const k = this.keys;
    const top = n[0];
    const lastN = n.pop() as number;
    const lastK = k.pop() as number;
    if (n.length > 0) {
      n[0] = lastN;
      k[0] = lastK;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < n.length && k[l] < k[m]) m = l;
        if (r < n.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [n[m], n[i]] = [n[i], n[m]];
        [k[m], k[i]] = [k[i], k[m]];
        i = m;
      }
    }
    return top;
  }
}

export interface PathResult {
  found: boolean;
  cells: number[];
  cost: number;
  expanded: number;
}

/**
 * Builds a per-cell cost multiplier (<= 1) that discounts cost near science targets.
 * Returns null when there are no targets. The multiplier floor is (1 - bonus).
 */
export function buildScienceField(
  grid: TerrainGrid,
  targets: LonLat[],
  radiusM: number,
  bonus: number,
): Float32Array | null {
  if (targets.length === 0) return null;
  const { cols, rows } = grid;
  const field = new Float32Array(cols * rows).fill(1);
  const rowDx: number[] = [];
  for (let r = 0; r < rows; r++) rowDx.push(cellSizeM(grid, r).dx);
  const dy = cellSizeM(grid, 0).dy;
  const dxMin = Math.min(...rowDx);
  for (const t of targets) {
    const tc = Math.floor((t.lon - grid.west) / grid.dLon);
    const tr = Math.floor((grid.north - t.lat) / grid.dLat);
    if (tc < 0 || tr < 0 || tc >= cols || tr >= rows) continue;
    const wc = Math.ceil(radiusM / dxMin) + 1;
    const wr = Math.ceil(radiusM / dy) + 1;
    for (let r = Math.max(0, tr - wr); r <= Math.min(rows - 1, tr + wr); r++) {
      for (let c = Math.max(0, tc - wc); c <= Math.min(cols - 1, tc + wc); c++) {
        const d = Math.hypot((c - tc) * rowDx[r], (r - tr) * dy);
        if (d < radiusM) {
          const m = 1 - bonus * (1 - d / radiusM);
          const i = r * cols + c;
          if (m < field[i]) field[i] = m;
        }
      }
    }
  }
  return field;
}

const NEIGHBOURS: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/**
 * A* over an 8-connected grid with DIRECTED edge costs (uphill and downhill differ).
 * Heuristic = (lowest possible cost multiplier) x straight-line distance, which is admissible and
 * consistent because every edge costs at least that multiplier times its planar length.
 */
export function findPath(
  grid: TerrainGrid,
  startIdx: number,
  goalIdx: number,
  profile: MobilityProfile,
  strategy: Strategy,
  scienceField: Float32Array | null,
  minMultiplier = 1,
): PathResult {
  const { cols, rows, elev } = grid;
  const n = cols * rows;
  const g = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const rowDx = new Float64Array(rows);
  for (let r = 0; r < rows; r++) rowDx[r] = cellSizeM(grid, r).dx;
  const dy = cellSizeM(grid, 0).dy;
  let dxMin = Infinity;
  for (let r = 0; r < rows; r++) if (rowDx[r] < dxMin) dxMin = rowDx[r];
  const goalC = goalIdx % cols;
  const goalR = Math.floor(goalIdx / cols);
  const heuristic = (i: number): number => {
    const c = i % cols;
    const r = (i - c) / cols;
    return minMultiplier * Math.hypot((c - goalC) * dxMin, (r - goalR) * dy);
  };

  const open = new MinHeap();
  g[startIdx] = 0;
  open.push(startIdx, heuristic(startIdx));
  let expanded = 0;

  while (open.size > 0) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;
    if (cur === goalIdx) {
      const cells: number[] = [];
      for (let p = cur; p !== -1; p = parent[p]) cells.push(p);
      cells.reverse();
      return { found: true, cells, cost: g[cur], expanded };
    }
    const c = cur % cols;
    const r = (cur - c) / cols;
    const zc = elev[cur];
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (closed[ni]) continue;
      const zn = elev[ni];
      if (Number.isNaN(zn)) continue; // no-data is never traversed
      const dxAvg = (rowDx[r] + rowDx[nr]) / 2;
      const dist = Math.hypot(dc * dxAvg, dr * dy);
      let cost = stepCost(dist, zn - zc, profile, strategy);
      if (!Number.isFinite(cost)) continue;
      if (scienceField) cost *= (scienceField[cur] + scienceField[ni]) / 2;
      const ng = g[cur] + cost;
      if (ng < g[ni]) {
        g[ni] = ng;
        parent[ni] = cur;
        open.push(ni, ng + heuristic(ni));
      }
    }
  }
  return { found: false, cells: [], cost: Infinity, expanded };
}
