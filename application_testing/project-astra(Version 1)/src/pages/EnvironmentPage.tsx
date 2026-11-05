import { CONTEXT_ITEMS } from '../data/environment';
import { useAstra } from '../store/useAstra';
import { Callout, ClassBadge, PageShell } from '../components/ui';
import { formatDuration, formatKm } from '../domain/mars';
import { hours } from '../components/routeUi';

const STATUS: Record<string, { text: string; cls: string }> = {
  'not-integrated': { text: 'Not integrated', cls: 'text-mute' },
  'display-only': { text: 'Available as a map layer', cls: 'text-obs' },
  assumption: { text: 'User-set planning input', cls: 'text-sim' },
};

export default function EnvironmentPage() {
  const speed = useAstra((s) => s.speedKmH);
  const setSpeed = useAstra((s) => s.setSpeed);
  const bundle = useAstra((s) => s.bundle);
  const out = bundle?.outbound.terrain;
  const ret = bundle?.returns.terrain;
  const total =
    out?.found && ret?.found && out.metrics && ret.metrics ? out.metrics.distanceM + ret.metrics.distanceM : null;

  return (
    <PageShell
      title="Mission context"
      intro="Environmental conditions matter to any mission, and this page is where they are documented. This build shows no environmental measurement values: each topic below states which sourced data would feed it, how it must be classified, and what it cannot tell you."
    >
      <div className="mb-6">
        <Callout tone="warn" title="Why there are no numbers here">
          Temperatures, pressures, winds and radiation doses are only meaningful with an instrument, a place, a date and a
          model or product version. None of those could be verified for this prototype, so nothing is displayed rather than
          showing something unverifiable. No live Mars weather is shown anywhere in this application.
        </Callout>
      </div>

      <ul className="space-y-4">
        {CONTEXT_ITEMS.map((c) => (
          <li key={c.id} className="panel p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{c.topic}</h2>
              <ClassBadge value={c.dataClass} />
              <span className={`text-xs font-medium ${STATUS[c.status].cls}`}>{STATUS[c.status].text}</span>
            </div>
            <p className="mt-2 leading-relaxed">{c.summary}</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <div className="label mb-1">How it would be shown</div>
                <p>{c.whatToShow}</p>
              </div>
              <div>
                <div className="label mb-1">Caveats</div>
                <ul className="list-disc space-y-1 pl-5">
                  {c.caveats.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            {c.sources.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {c.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="text-rust-soft underline">
                    {s.title}
                  </a>
                ))}
              </div>
            )}
            {c.id === 'mission-assumptions' && (
              <div className="mt-4 rounded-md border border-line bg-panel2 p-3">
                <label htmlFor="env-speed" className="flex justify-between">
                  <span className="label">Average traverse speed</span>
                  <span className="font-mono">{speed.toFixed(1)} km/h</span>
                </label>
                <input
                  id="env-speed"
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="mt-2 w-full accent-[#d9632b]"
                />
                <p className="mt-2 text-xs text-mute">
                  {total !== null
                    ? `Current terrain-conscious round trip: ${formatKm(total)}, about ${formatDuration(hours(total, speed))} of travel at this speed (hypothetical).`
                    : 'Plan a route to see its hypothetical duration.'}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
