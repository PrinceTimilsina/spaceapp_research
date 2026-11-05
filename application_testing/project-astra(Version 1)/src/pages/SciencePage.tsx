import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { POIS } from '../data/pois';
import { getDataset } from '../data/registry';
import { useGeology, unitColor } from '../data/useGeology';
import { useAstra } from '../store/useAstra';
import { formatLonLat } from '../domain/mars';
import { Callout, ClassBadge, PageShell } from '../components/ui';

export default function SciencePage() {
  const [cat, setCat] = useState<string>('All');
  const [onlyMapped, setOnlyMapped] = useState(false);
  const navigate = useNavigate();
  const focusOn = useAstra((s) => s.focusOn);
  const selectPoi = useAstra((s) => s.selectPoi);
  const addWaypoint = useAstra((s) => s.addWaypoint);
  const toggleAttractor = useAstra((s) => s.toggleAttractor);
  const attractors = useAstra((s) => s.attractorPoiIds);
  const geology = useGeology();
  const sim = getDataset('usgs-sim3464');

  const cats = useMemo(() => ['All', ...Array.from(new Set(POIS.map((p) => p.category)))], []);
  const list = POIS.filter((p) => (cat === 'All' || p.category === cat) && (!onlyMapped || p.location));
  const unmapped = POIS.filter((p) => !p.location).length;

  return (
    <PageShell
      wide
      title="Science guide"
      intro="Scientifically described features of Jezero. Every entry cites its source. A feature is drawn on the map only when a coordinate with a traceable source exists, so some entries intentionally have no map position."
    >
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Callout tone="warn" title="Coordinates are limited on purpose">
          {unmapped} of {POIS.length} entries have no verified coordinate in the sources checked for this prototype. They
          are listed with their descriptions but not placed on the map, because placing them from memory would be
          inventing data. Add a record with a citation in <code className="font-mono">src/data/pois.ts</code> to map one.
        </Callout>
        <div className="panel p-4 text-sm">
          <div className="label mb-1">Geology: USGS SIM 3464</div>
          <p className="mb-2 leading-relaxed">
            {sim?.name}. {sim?.coverage}. Scale {sim?.resolution}.
          </p>
          <p className="mb-2">
            {geology.status === 'present' ? (
              <>
                Unit polygons are loaded ({geology.units.length} distinct values in “{geology.nameKey}”). Toggle them under{' '}
                <Link to="/map" className="text-rust-soft underline">Map → Layers</Link>.
              </>
            ) : geology.status === 'invalid' ? (
              'A geology file was found but is not valid GeoJSON.'
            ) : geology.status === 'loading' ? (
              'Checking for a converted geology file…'
            ) : (
              <>
                Only the published map footprint is drawn. To overlay the unit polygons, convert the USGS database with{' '}
                <code className="font-mono">pipeline/convert_geology.sh</code>.
              </>
            )}
          </p>
          {geology.status === 'present' && geology.units.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
              {geology.units.map((u) => (
                <li key={u} className="flex items-center gap-1.5 text-xs">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: unitColor(u) }} />
                  {u}
                </li>
              ))}
            </ul>
          )}
          {sim?.sourceUrl && (
            <a href={sim.sourceUrl} className="text-rust-soft underline" target="_blank" rel="noreferrer">
              USGS publication page
            </a>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter features">
        {cats.map((c) => (
          <button key={c} className={`btn ${cat === c ? 'btn-active' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-mute">
          <input type="checkbox" className="accent-[#d9632b]" checked={onlyMapped} onChange={(e) => setOnlyMapped(e.target.checked)} />
          Only features with a map position
        </label>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <li key={p.id} className="panel flex flex-col p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="label">{p.category}</div>
                <h2 className="text-base font-semibold">{p.name}</h2>
              </div>
              <ClassBadge value={p.dataClass} />
            </div>
            <p className="mt-2 leading-relaxed">{p.significance}</p>
            <div className="mt-3 text-xs">
              <span className="label">Location: </span>
              {p.location ? (
                <span className="font-mono">{formatLonLat(p.location, 2)}</span>
              ) : (
                <span className="italic text-mute">no sourced coordinate</span>
              )}
            </div>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-mute hover:text-ink">Sources and limitations</summary>
              <div className="mt-2 space-y-2">
                <div>{p.locationSource}</div>
                <ul className="list-disc space-y-0.5 pl-4">
                  {p.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
                <div className="space-y-0.5">
                  {p.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block text-rust-soft underline">
                      {s.title}
                    </a>
                  ))}
                </div>
              </div>
            </details>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              {p.location && (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      if (p.location) focusOn(p.location.lon, p.location.lat, 12);
                      selectPoi(p.id);
                      navigate('/map');
                    }}
                  >
                    Show on map
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      if (!p.location) return;
                      addWaypoint({ name: p.name.split(' (')[0], location: p.location, origin: 'poi', poiId: p.id });
                      navigate('/planner');
                    }}
                  >
                    Add as route stop
                  </button>
                  <button
                    className={`btn ${attractors.includes(p.id) ? 'btn-active' : ''}`}
                    aria-pressed={attractors.includes(p.id)}
                    onClick={() => toggleAttractor(p.id)}
                  >
                    {attractors.includes(p.id) ? 'Attracting' : 'Attract science route'}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-mute">No features match this filter.</p>}
    </PageShell>
  );
}
