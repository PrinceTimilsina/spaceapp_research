import { Link } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { resolveProfile, scienceTargetsOf, useAstra } from '../store/useAstra';
import { DATASETS } from '../data/registry';
import { GLOBAL_LIMITATIONS, PROTOTYPE_NOTICE, SITE } from '../data/site';
import { MAPPABLE_POIS } from '../data/pois';
import { STRATEGIES, STRATEGY_INFO } from '../domain/costModel';
import { formatDuration, formatKm, formatLonLat } from '../domain/mars';
import { ClassBadge, PageShell } from '../components/ui';
import RouteSchematic from '../components/RouteSchematic';
import { ComparisonTable, hours, strategyRows } from '../components/routeUi';

export default function FieldGuidePage() {
  const s = useAstra();
  const grid = s.terrain.grid;
  const profile = resolveProfile(s);
  const targets = scienceTargetsOf(s);
  const simulated = grid?.source === 'simulated';
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

  const download = () => {
    const payload = {
      generatedBy: SITE.name,
      generatedAt: new Date().toISOString(),
      notice: PROTOTYPE_NOTICE,
      terrain: grid ? { id: grid.id, source: grid.source, dataClass: grid.dataClass, label: grid.label, resolutionM: grid.resolutionM } : null,
      plan: {
        start: s.start,
        destination: s.destination,
        returnPoint: s.returnPoint,
        waypoints: s.waypoints,
        profile,
        speedKmH: s.speedKmH,
        scienceAttractors: targets,
      },
      routes: s.bundle
        ? Object.fromEntries(
            ['outbound', 'returns'].flatMap((k) =>
              STRATEGIES.map((st) => {
                const r = (k === 'outbound' ? s.bundle!.outbound : s.bundle!.returns)[st];
                return [`${k}-${st}`, { found: r.found, error: r.error ?? null, metrics: r.metrics, simulated: r.simulated, coordinates: r.coordinates }];
              }),
            ),
          )
        : null,
      limitations: GLOBAL_LIMITATIONS,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'astra-mission-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      title="Mission field guide"
      intro="A printable summary of your current mission plan: points, assumptions, route comparison, schematic, sources and limitations. Use your browser's print dialog to save it as a PDF."
    >
      <div className="no-print mb-6 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={15} /> Print / save as PDF
        </button>
        <button className="btn" onClick={download}>
          <Download size={15} /> Download plan data (JSON)
        </button>
        <Link to="/planner" className="btn">Edit the plan</Link>
      </div>

      <article className="print-sheet panel space-y-8 p-6 sm:p-8" aria-label="Mission field guide document">
        <header className="print-avoid-break border-b border-line pb-4">
          <div className="label">PROJECT ASTRA · Mission field guide</div>
          <h2 className="mt-1 text-2xl font-semibold">Jezero Crater hypothetical traverse</h2>
          <p className="mt-1 text-xs text-mute">Generated {when}</p>
          <p className="mt-3 text-sm font-semibold">{PROTOTYPE_NOTICE}</p>
          {simulated && (
            <p className="mt-2 border border-sim/50 bg-sim/10 px-3 py-2 text-sm font-semibold text-sim">
              SIMULATED TERRAIN: the routes below were computed on a synthetic surface and demonstrate the planning
              algorithm only. They say nothing about real Jezero traversability.
            </p>
          )}
        </header>

        <section className="print-avoid-break">
          <h3 className="mb-2 text-lg font-semibold">1. Mission definition</h3>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[11rem_1fr]">
            <dt className="text-mute">Start</dt>
            <dd className="font-mono">{s.start ? formatLonLat(s.start, 4) : 'not set'}</dd>
            <dt className="text-mute">Destination</dt>
            <dd className="font-mono">{s.destination ? formatLonLat(s.destination, 4) : 'not set'}</dd>
            <dt className="text-mute">Return point</dt>
            <dd className="font-mono">{s.returnPoint ? formatLonLat(s.returnPoint, 4) : 'same as start'}</dd>
            <dt className="text-mute">Science stops</dt>
            <dd>
              {s.waypoints.length === 0 ? 'none' : (
                <ol className="list-decimal pl-5">
                  {s.waypoints.map((w) => (
                    <li key={w.id}>{w.name} <span className="font-mono text-xs">({formatLonLat(w.location, 3)})</span></li>
                  ))}
                </ol>
              )}
            </dd>
            <dt className="text-mute">Mobility profile</dt>
            <dd>
              {profile.name}: max edge slope {profile.maxSlopeDeg}°, terrain weight {profile.terrainWeight}, uphill weight {profile.uphillWeight}.
              <span className="block text-xs text-mute">Planning assumption, not a NASA or vendor specification.</span>
            </dd>
            <dt className="text-mute">Traverse speed</dt>
            <dd>{s.speedKmH.toFixed(1)} km/h <span className="text-xs text-mute">(hypothetical input)</span></dd>
            <dt className="text-mute">Terrain used</dt>
            <dd>{grid ? <>{grid.label} <ClassBadge value={grid.dataClass} /></> : '—'}</dd>
          </dl>
        </section>

        {grid && (
          <section>
            <h3 className="mb-2 text-lg font-semibold">2. Route schematic</h3>
            <RouteSchematic
              grid={grid}
              slope={s.terrain.slope}
              bundle={s.bundle}
              start={s.start}
              destination={s.destination}
              returnPoint={s.returnPoint}
              waypoints={s.waypoints}
            />
          </section>
        )}

        {s.bundle ? (
          <section>
            <h3 className="mb-2 text-lg font-semibold">3. Outbound routes</h3>
            <ComparisonTable rows={strategyRows(s.bundle, 'outbound')} speedKmH={s.speedKmH} />
            <h3 className="mb-2 mt-6 text-lg font-semibold">4. Return routes</h3>
            <ComparisonTable rows={strategyRows(s.bundle, 'return')} speedKmH={s.speedKmH} />
            <div className="print-avoid-break mt-6">
              <h3 className="mb-2 text-lg font-semibold">5. Round trip summary</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-mute">
                    <th className="py-1.5 pr-3 font-medium">Strategy</th>
                    <th className="py-1.5 pr-3 font-medium">Round trip</th>
                    <th className="py-1.5 font-medium">Time at {s.speedKmH.toFixed(1)} km/h</th>
                  </tr>
                </thead>
                <tbody>
                  {STRATEGIES.map((st) => {
                    const o = s.bundle!.outbound[st];
                    const r = s.bundle!.returns[st];
                    const ok = o.found && r.found && o.metrics && r.metrics;
                    return (
                      <tr key={st} className="border-b border-line/60">
                        <td className="py-1.5 pr-3">{STRATEGY_INFO[st].name}</td>
                        <td className="py-1.5 pr-3 font-mono">{ok ? formatKm(o.metrics!.distanceM + r.metrics!.distanceM) : 'n/a'}</td>
                        <td className="py-1.5 font-mono">{ok ? formatDuration(hours(o.metrics!.distanceM + r.metrics!.distanceM, s.speedKmH)) : 'n/a'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-mute">
                Terrain burden is a relative model index (percent extra effort over flat ground), not a safety score.
              </p>
            </div>
            <div className="mt-6">
              <h3 className="mb-2 text-lg font-semibold">6. How the routes were chosen</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {s.bundle.outbound.terrain.explanation.slice(0, 4).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          <p className="text-sm text-mute">No routes yet. Set a start and destination in the planner.</p>
        )}

        <section className="print-avoid-break">
          <h3 className="mb-2 text-lg font-semibold">7. Sourced points of interest on the map</h3>
          <ul className="space-y-2 text-sm">
            {MAPPABLE_POIS.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.name}</span>{' '}
                <span className="font-mono text-xs">{p.location ? formatLonLat(p.location, 2) : ''}</span>
                <div className="text-xs text-mute">{p.locationSource}</div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-lg font-semibold">8. Data sources</h3>
          <ul className="space-y-2 text-sm">
            {DATASETS.map((d) => (
              <li key={d.id} className="print-avoid-break">
                <span className="font-medium">{d.name}</span> <ClassBadge value={d.dataClass} />
                <div className="text-xs text-mute">
                  {d.attribution}
                  {d.sourceUrl ? ` · ${d.sourceUrl}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="print-avoid-break">
          <h3 className="mb-2 text-lg font-semibold">9. Limitations</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {GLOBAL_LIMITATIONS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      </article>
    </PageShell>
  );
}
