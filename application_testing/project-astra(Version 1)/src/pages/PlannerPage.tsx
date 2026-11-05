import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDown, ArrowUp, Crosshair, MapPin, RotateCcw, Trash2 } from 'lucide-react';
import MapView from '../map/MapView';
import { resolveProfile, routeByKey, useAstra, type PickMode } from '../store/useAstra';
import { MAPPABLE_POIS } from '../data/pois';
import { PROFILES, SCIENCE_BONUS, SCIENCE_RADIUS_M, STRATEGIES, STRATEGY_INFO } from '../domain/costModel';
import { formatDuration, formatKm, formatLonLat } from '../domain/mars';
import type { LonLat, Strategy } from '../types';
import { STRATEGY_COLORS } from '../data/layers';
import { Callout, ClassBadge, PageShell, Stat } from '../components/ui';
import { ComparisonTable, hours, strategyRows } from '../components/routeUi';

function PointEditor({
  label,
  kind,
  value,
  clearable,
}: {
  label: string;
  kind: 'start' | 'destination' | 'return';
  value: LonLat | null;
  clearable?: boolean;
}) {
  const setPoint = useAstra((s) => s.setPoint);
  const pickMode = useAstra((s) => s.pickMode);
  const setPickMode = useAstra((s) => s.setPickMode);
  const active = pickMode === kind;
  return (
    <div className="rounded-md border border-line bg-panel2 p-2.5">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <div className="flex gap-1">
          <button
            className={`btn px-2 py-1 text-xs ${active ? 'btn-active' : ''}`}
            aria-pressed={active}
            onClick={() => setPickMode(active ? null : (kind as PickMode))}
          >
            <Crosshair size={13} /> {active ? 'Click map…' : 'Pick on map'}
          </button>
          {clearable && value && (
            <button className="btn px-2 py-1 text-xs" onClick={() => setPoint(kind, null)}>
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 font-mono text-xs">{value ? formatLonLat(value, 4) : <span className="text-mute">not set</span>}</div>
      <div className="mt-2 flex items-center gap-2">
        <select
          aria-label={`${label}: choose a sourced point of interest`}
          className="field text-xs"
          value=""
          onChange={(e) => {
            const p = MAPPABLE_POIS.find((x) => x.id === e.target.value);
            if (p?.location) setPoint(kind, p.location);
          }}
        >
          <option value="">From a sourced point of interest…</option>
          {MAPPABLE_POIS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function PlannerPage() {
  const s = useAstra();
  const profile = resolveProfile(s);
  const grid = s.terrain.grid;
  const simulated = grid?.source === 'simulated';
  const [dir, setDir] = useState<'outbound' | 'return' | 'retrace'>('outbound');
  const [strategy, setStrategy] = useState<Strategy>('terrain');

  const key = `${dir}-${strategy}`;
  // Keep the map highlight in sync with the chosen route.
  useEffect(() => {
    useAstra.getState().selectRoute(key);
  }, [key]);

  const route = routeByKey(s.bundle, key);
  const out = s.bundle?.outbound[strategy] ?? null;
  const ret = s.bundle?.returns[strategy] ?? null;
  const retrace = s.bundle?.retrace[strategy] ?? null;
  const retraceAvailable = Boolean(s.bundle && Object.values(s.bundle.retrace).some(Boolean));

  const chartData = useMemo(
    () => (route?.profile ?? []).map((p) => ({ d: Math.round(p.distM), e: Math.round(p.elev * 10) / 10, sl: Math.round(p.slopeDeg * 10) / 10 })),
    [route],
  );

  const ready = s.terrain.status === 'ready';
  const slopeValue = s.maxSlopeOverride ?? profile.maxSlopeDeg;

  return (
    <PageShell
      wide
      title="Mission route planner"
      intro="Plan an outbound route and its return with A* pathfinding over the terrain grid. Costs are directed (climbing costs more than descending), the cost function is shown below, and nothing here is a safety assessment."
    >
      {simulated && (
        <div className="mb-4">
          <Callout tone="sim" title="Routes are computed on SIMULATED terrain">
            No real DEM file was found, so these routes demonstrate the algorithm only and say nothing about real Jezero
            traversability. See <Link to="/data" className="underline">Data &amp; limits</Link> and the README to supply a real DEM.
          </Callout>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        {/* ---------- controls ---------- */}
        <aside className="space-y-4" aria-label="Mission inputs">
          <section className="panel space-y-3 p-3">
            <h2 className="text-sm font-semibold">Mission points</h2>
            <PointEditor label="Start" kind="start" value={s.start} />
            <PointEditor label="Destination" kind="destination" value={s.destination} />
            <PointEditor label="Return point (default: start)" kind="return" value={s.returnPoint} clearable />
          </section>

          <section className="panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Science stops ({s.waypoints.length})</h2>
              <button
                className={`btn px-2 py-1 text-xs ${s.pickMode === 'stop' ? 'btn-active' : ''}`}
                onClick={() => s.setPickMode(s.pickMode === 'stop' ? null : 'stop')}
                aria-pressed={s.pickMode === 'stop'}
              >
                <MapPin size={13} /> {s.pickMode === 'stop' ? 'Click map…' : 'Add stop on map'}
              </button>
            </div>
            {s.waypoints.length === 0 ? (
              <p className="text-xs text-mute">Optional waypoints the route must pass through, in order. Stops also attract the science-focused route.</p>
            ) : (
              <ol className="space-y-2">
                {s.waypoints.map((w, i) => (
                  <li key={w.id} className="flex items-center gap-1.5 rounded border border-line bg-panel2 p-1.5">
                    <span className="w-5 text-center font-mono text-xs text-mute">{i + 1}</span>
                    <input
                      className="field min-w-0 flex-1 py-1 text-xs"
                      value={w.name}
                      aria-label={`Stop ${i + 1} name`}
                      onChange={(e) => s.renameWaypoint(w.id, e.target.value)}
                      onBlur={() => void s.runPlan()}
                    />
                    <button className="btn px-1.5 py-1" aria-label="Move up" disabled={i === 0} onClick={() => s.moveWaypoint(w.id, -1)}>
                      <ArrowUp size={13} />
                    </button>
                    <button className="btn px-1.5 py-1" aria-label="Move down" disabled={i === s.waypoints.length - 1} onClick={() => s.moveWaypoint(w.id, 1)}>
                      <ArrowDown size={13} />
                    </button>
                    <button className="btn px-1.5 py-1" aria-label="Remove stop" onClick={() => s.removeWaypoint(w.id)}>
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel space-y-3 p-3">
            <h2 className="text-sm font-semibold">Mobility profile (planning assumption)</h2>
            <div className="grid grid-cols-3 gap-1" role="group" aria-label="Mobility profile">
              {PROFILES.map((p) => (
                <button key={p.id} className={`btn px-2 text-xs ${s.profileId === p.id ? 'btn-active' : ''}`} aria-pressed={s.profileId === p.id} onClick={() => s.setProfile(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-mute">{profile.description} Not a NASA or vendor specification.</p>
            <div>
              <label htmlFor="slope-limit" className="flex justify-between text-xs">
                <span className="label">Max edge slope (hard limit)</span>
                <span className="font-mono">{slopeValue}°</span>
              </label>
              <input
                id="slope-limit"
                type="range"
                min={5}
                max={35}
                step={1}
                value={slopeValue}
                onChange={(e) => s.setMaxSlopeOverride(Number(e.target.value))}
                className="mt-1 w-full accent-[#d9632b]"
              />
              {s.maxSlopeOverride !== null && (
                <button className="mt-1 text-xs text-rust-soft underline" onClick={() => s.setMaxSlopeOverride(null)}>
                  Reset to profile ({PROFILES.find((p) => p.id === s.profileId)?.maxSlopeDeg}°)
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Terrain weight" value={profile.terrainWeight} />
              <Stat label="Uphill weight" value={profile.uphillWeight} />
            </div>
            <div>
              <label htmlFor="speed" className="flex justify-between text-xs">
                <span className="label">Average speed (hypothetical)</span>
                <span className="font-mono">{s.speedKmH.toFixed(1)} km/h</span>
              </label>
              <input
                id="speed"
                type="range"
                min={0.1}
                max={5}
                step={0.1}
                value={s.speedKmH}
                onChange={(e) => s.setSpeed(Number(e.target.value))}
                className="mt-1 w-full accent-[#d9632b]"
              />
              <p className="mt-1 text-[11px] text-mute">
                <ClassBadge value="SIMULATED" /> A planning input used only to convert distance to duration.
              </p>
            </div>
          </section>

          <section className="panel p-3">
            <h2 className="mb-2 text-sm font-semibold">Science attractors</h2>
            <p className="mb-2 text-xs text-mute">Targets that pull the science-focused route toward them (bounded discount, never forced).</p>
            <ul className="space-y-1">
              {MAPPABLE_POIS.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-[#d9632b]" checked={s.attractorPoiIds.includes(p.id)} onChange={() => s.toggleAttractor(p.id)} />
                    {p.name.split(' (')[0]}
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <button className="btn w-full" onClick={() => s.resetPlan()}>
            <RotateCcw size={14} /> Reset to the demonstration plan
          </button>
        </aside>

        {/* ---------- map + results ---------- */}
        <div className="min-w-0 space-y-6">
          <div className="panel overflow-hidden">
            <MapView className="h-[52vh] min-h-[360px] w-full" />
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-3 py-2 text-xs text-mute">
              {STRATEGIES.map((st) => (
                <span key={st} className="flex items-center gap-1.5">
                  <span className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: STRATEGY_COLORS[st] }} />
                  {STRATEGY_INFO[st].name}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0 w-5 border-t-[3px] border-dashed border-ink" /> Return
              </span>
              <span>Toggle imagery, slope and elevation layers on the <Link to="/map" className="text-rust-soft underline">Map</Link> page.</span>
            </div>
          </div>

          {s.planError && !s.planning && <Callout tone="warn" title="Cannot plan yet">{s.planError}</Callout>}
          {!ready && <p className="text-mute">Preparing terrain grid…</p>}
          {s.planning && <p className="text-sm text-mute" aria-live="polite">Computing routes…</p>}

          {s.bundle && (
            <>
              <section className="panel p-4" aria-label="Outbound comparison">
                <h2 className="mb-1 text-base font-semibold">Outbound strategies</h2>
                <p className="mb-3 text-xs text-mute">Select a row to inspect it. Percent and metre deltas are relative to the shortest route.</p>
                <ComparisonTable rows={strategyRows(s.bundle, 'outbound')} speedKmH={s.speedKmH} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {STRATEGIES.map((st) => (
                    <button key={st} className={`btn ${strategy === st ? 'btn-active' : ''}`} aria-pressed={strategy === st} onClick={() => setStrategy(st)}>
                      Inspect {STRATEGY_INFO[st].name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel p-4" aria-label="Outbound versus return">
                <h2 className="mb-1 text-base font-semibold">Outbound vs return ({STRATEGY_INFO[strategy].name})</h2>
                <p className="mb-3 text-xs text-mute">
                  The return is planned as its own route with directed costs. “Retrace” walks the outbound path backwards,
                  to show how much re-planning the return changes.
                </p>
                <ComparisonTable
                  speedKmH={s.speedKmH}
                  rows={[
                    { label: 'Outbound', route: out },
                    { label: 'Return (re-planned)', route: ret },
                    ...(retraceAvailable ? [{ label: 'Return (retraced outbound)', route: retrace }] : []),
                  ]}
                />
                {out?.metrics && ret?.metrics && (
                  <p className="mt-3 text-sm">
                    Round trip: <span className="font-mono">{formatKm(out.metrics.distanceM + ret.metrics.distanceM)}</span>,{' '}
                    <span className="font-mono">{formatDuration(hours(out.metrics.distanceM + ret.metrics.distanceM, s.speedKmH))}</span> at {s.speedKmH} km/h
                    (hypothetical).
                  </p>
                )}
                {!retraceAvailable && <p className="mt-2 text-xs text-mute">Retrace comparison is available only when the return point equals the start.</p>}
              </section>

              <section className="panel p-4" aria-label="Route detail">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">Route detail</h2>
                  <div className="ml-auto flex gap-1" role="group" aria-label="Direction">
                    {(['outbound', 'return', ...(retraceAvailable ? ['retrace'] : [])] as ('outbound' | 'return' | 'retrace')[]).map((d) => (
                      <button key={d} className={`btn px-2.5 text-xs ${dir === d ? 'btn-active' : ''}`} aria-pressed={dir === d} onClick={() => setDir(d)}>
                        {d === 'retrace' ? 'Return (retraced)' : d === 'return' ? 'Return (re-planned)' : 'Outbound'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-3 flex gap-1" role="group" aria-label="Strategy">
                  {STRATEGIES.map((st) => (
                    <button key={st} className={`btn px-2.5 text-xs ${strategy === st ? 'btn-active' : ''}`} aria-pressed={strategy === st} onClick={() => setStrategy(st)}>
                      {STRATEGY_INFO[st].name}
                    </button>
                  ))}
                </div>

                {route && !route.found && <Callout tone="warn" title="No route">{route.error}</Callout>}
                {route?.found && route.metrics && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                      <Stat label="Distance" value={formatKm(route.metrics.distanceM)} hint="Planar distance along the grid path" />
                      <Stat label="3D length" value={formatKm(route.metrics.length3dM)} />
                      <Stat label="Climb" value={`${route.metrics.gainM.toFixed(0)} m`} />
                      <Stat label="Descent" value={`${route.metrics.lossM.toFixed(0)} m`} />
                      <Stat label="Mean slope" value={`${route.metrics.meanSlopeDeg.toFixed(1)}°`} />
                      <Stat label="Max edge slope" value={`${route.metrics.maxSlopeDeg.toFixed(1)}°`} />
                      <Stat label="Terrain burden" value={`${route.metrics.terrainBurdenPct.toFixed(1)}%`} hint="Relative model index: extra effort over flat ground. Not a safety score." />
                      <Stat label="Time" value={formatDuration(hours(route.metrics.distanceM, s.speedKmH))} hint="Hypothetical, from your chosen speed" />
                      <Stat label="No-data crossed" value={route.metrics.nodataCellsCrossed} />
                      <Stat label="Grid steps" value={route.metrics.cellCount} />
                    </div>

                    <div>
                      <div className="label mb-1">
                        Elevation profile {simulated && <span className="text-sim">(SIMULATED relative metres)</span>}
                      </div>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
                            <CartesianGrid stroke="#272b31" />
                            <XAxis dataKey="d" type="number" domain={[0, 'dataMax']} tick={{ fill: '#8c929a', fontSize: 11 }} unit=" m" />
                            <YAxis tick={{ fill: '#8c929a', fontSize: 11 }} unit=" m" domain={['auto', 'auto']} width={56} />
                            <Tooltip
                              contentStyle={{ background: '#141619', border: '1px solid #272b31', fontSize: 12 }}
                              formatter={(v, name) => [name === 'e' ? `${v} m` : `${v}°`, name === 'e' ? 'Elevation' : 'Edge slope']}
                              labelFormatter={(l) => `${l} m along route`}
                            />
                            <Area type="monotone" dataKey="e" stroke={STRATEGY_COLORS[strategy]} fill={STRATEGY_COLORS[strategy] + '33'} dot={false} isAnimationActive={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <div className="label mb-1">Why this route</div>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {route.explanation.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="label mb-1">Science targets within {(SCIENCE_RADIUS_M / 1000).toFixed(1)} km of the path</div>
                          {route.metrics.scienceNear.length === 0 ? (
                            <p className="text-sm text-mute">None among your stops and selected attractors.</p>
                          ) : (
                            <ul className="space-y-0.5 text-sm">
                              {route.metrics.scienceNear.map((t) => (
                                <li key={t.id}>
                                  {t.name} <span className="font-mono text-xs text-mute">{t.distanceM.toFixed(0)} m</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <div className="label mb-1">Data notes</div>
                          <ul className="list-disc space-y-1 pl-5 text-sm text-der">
                            {route.warnings.map((w) => (
                              <li key={w}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {route.segments.length > 0 && (
                      <div className="overflow-x-auto">
                        <div className="label mb-1">Legs</div>
                        <table className="w-full min-w-[28rem] text-left text-sm">
                          <thead>
                            <tr className="border-b border-line text-xs uppercase tracking-wider text-mute">
                              <th className="py-1.5 pr-3 font-medium">From → to</th>
                              <th className="py-1.5 pr-3 font-medium">Distance</th>
                              <th className="py-1.5 pr-3 font-medium">Climb / descent</th>
                              <th className="py-1.5 font-medium">Max slope</th>
                            </tr>
                          </thead>
                          <tbody>
                            {route.segments.map((g) => (
                              <tr key={`${g.fromName}-${g.toName}`} className="border-b border-line/60">
                                <td className="py-1.5 pr-3">{g.fromName} → {g.toName}</td>
                                <td className="py-1.5 pr-3 font-mono">{formatKm(g.distanceM)}</td>
                                <td className="py-1.5 pr-3 font-mono">+{g.gainM.toFixed(0)} / −{g.lossM.toFixed(0)} m</td>
                                <td className="py-1.5 font-mono">{g.maxSlopeDeg.toFixed(1)}°</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <Callout title="How costs are computed">
                <code className="font-mono text-xs">
                  edge cost = distance × (1 + w<sub>t</sub> × penalty)
                </code>
                , <code className="font-mono text-xs">penalty = (slope / maxSlope)² + w<sub>up</sub> × max(0, rise / run)</code>. Edges
                steeper than the limit are impassable and no-data cells are never crossed. The science strategy multiplies edge cost by
                as little as {(1 - SCIENCE_BONUS).toFixed(2)} within {(SCIENCE_RADIUS_M / 1000).toFixed(1)} km of an attractor. This is an effort model for comparing options, not a safety score:
                no route here is claimed to be safe.
              </Callout>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
