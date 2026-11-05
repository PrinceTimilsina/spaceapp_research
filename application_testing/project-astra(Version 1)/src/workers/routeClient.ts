import type { TerrainGrid } from '../domain/grid';
import { planAll, type PlanBundle, type PlanInput } from '../domain/routePlanner';

/**
 * Promise wrapper around the route worker. Falls back to the main thread if Workers are unavailable,
 * so planning still works in restricted environments.
 */

let worker: Worker | null = null;
let broken = false;
let loadedKey: string | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (b: PlanBundle) => void; reject: (e: Error) => void }>();

function key(g: TerrainGrid): string {
  return `${g.id}:${g.cols}x${g.rows}`;
}

function failAll(message: string): void {
  for (const p of pending.values()) p.reject(new Error(message));
  pending.clear();
}

function getWorker(): Worker | null {
  if (broken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./routeWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; id: number; bundle?: PlanBundle; message?: string };
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.type === 'result' && m.bundle) p.resolve(m.bundle);
      else p.reject(new Error(m.message ?? 'Route worker error'));
    };
    worker.onerror = () => {
      broken = true;
      worker = null;
      loadedKey = null;
      failAll('Route worker failed');
    };
    return worker;
  } catch {
    broken = true;
    return null;
  }
}

export async function planRoutes(grid: TerrainGrid, input: PlanInput): Promise<PlanBundle> {
  const w = getWorker();
  if (w) {
    try {
      if (loadedKey !== key(grid)) {
        w.postMessage({ type: 'init', grid });
        loadedKey = key(grid);
      }
      const id = ++seq;
      return await new Promise<PlanBundle>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        w.postMessage({ type: 'plan', id, input });
      });
    } catch (err) {
      console.warn('[ASTRA] Worker planning failed, using main thread:', err);
    }
  }
  return planAll(grid, input);
}
