import type { PlanBundle, RouteResult } from '../domain/routePlanner';
import { STRATEGIES, STRATEGY_INFO } from '../domain/costModel';
import { formatDuration, formatKm } from '../domain/mars';
import type { Strategy } from '../types';

export function hours(distanceM: number, speedKmH: number): number {
  return speedKmH > 0 ? distanceM / 1000 / speedKmH : Infinity;
}

export interface Row {
  label: string;
  route: RouteResult | null;
}

export function ComparisonTable({
  rows,
  speedKmH,
  baselineIndex = 0,
}: {
  rows: Row[];
  speedKmH: number;
  baselineIndex?: number;
}) {
  const base = rows[baselineIndex]?.route?.metrics ?? null;
  const delta = (v: number, b: number | undefined, unit: string, digits = 0) => {
    if (b === undefined || b === 0) return '';
    const d = v - b;
    if (Math.abs(d) < 0.5 * 10 ** -digits) return '';
    return ` (${d > 0 ? '+' : ''}${d.toFixed(digits)} ${unit})`;
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wider text-mute">
            <th className="py-2 pr-3 font-medium">Route</th>
            <th className="py-2 pr-3 font-medium">Distance</th>
            <th className="py-2 pr-3 font-medium">Climb / descent</th>
            <th className="py-2 pr-3 font-medium">Max edge slope</th>
            <th className="py-2 pr-3 font-medium" title="Relative model index: extra effort over flat ground. Not a safety score.">
              Terrain burden
            </th>
            <th className="py-2 font-medium">Time at {speedKmH} km/h</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const m = r.route?.metrics;
            return (
              <tr key={r.label} className="border-b border-line/60 align-top">
                <td className="py-2 pr-3 font-medium">{r.label}</td>
                {m && r.route?.found ? (
                  <>
                    <td className="py-2 pr-3 font-mono tabular-nums">
                      {formatKm(m.distanceM)}
                      <span className="text-xs text-mute">{i !== baselineIndex ? delta(m.distanceM, base?.distanceM, 'm') : ''}</span>
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums">
                      +{m.gainM.toFixed(0)} / −{m.lossM.toFixed(0)} m
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums">{m.maxSlopeDeg.toFixed(1)}°</td>
                    <td className="py-2 pr-3 font-mono tabular-nums">
                      {m.terrainBurdenPct.toFixed(1)}%
                      <span className="text-xs text-mute">{i !== baselineIndex ? delta(m.terrainBurdenPct, base?.terrainBurdenPct, 'pt', 1) : ''}</span>
                    </td>
                    <td className="py-2 font-mono tabular-nums">{formatDuration(hours(m.distanceM, speedKmH))}</td>
                  </>
                ) : (
                  <td colSpan={5} className="py-2 text-der">
                    {r.route?.error ?? 'Not available'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function strategyRows(bundle: PlanBundle, dir: 'outbound' | 'return'): Row[] {
  const set = dir === 'outbound' ? bundle.outbound : bundle.returns;
  return STRATEGIES.map((s: Strategy) => ({ label: STRATEGY_INFO[s].name, route: set[s] }));
}
