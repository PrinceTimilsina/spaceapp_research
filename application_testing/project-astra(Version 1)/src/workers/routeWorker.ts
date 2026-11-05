import { planAll, type PlanInput } from '../domain/routePlanner';
import type { TerrainGrid } from '../domain/grid';

/** Route-planning worker: keeps A* off the UI thread. The grid is sent once, then plan requests follow. */

interface WorkerScope {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
}
const ctx = self as unknown as WorkerScope;

let grid: TerrainGrid | null = null;

ctx.onmessage = (e: MessageEvent) => {
  const m = e.data as
    | { type: 'init'; grid: TerrainGrid }
    | { type: 'plan'; id: number; input: PlanInput };
  if (m.type === 'init') {
    grid = m.grid;
    return;
  }
  if (m.type === 'plan') {
    try {
      if (!grid) throw new Error('Terrain grid not loaded in worker');
      ctx.postMessage({ type: 'result', id: m.id, bundle: planAll(grid, m.input) });
    } catch (err) {
      ctx.postMessage({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
};
