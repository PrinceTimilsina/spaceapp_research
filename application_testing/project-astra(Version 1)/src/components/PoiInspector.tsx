import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getPoi } from '../data/pois';
import { useAstra } from '../store/useAstra';
import { formatLonLat } from '../domain/mars';
import { ClassBadge } from './ui';

/** Details of a selected point of interest with real actions that feed the planner. */
export default function PoiInspector({ poiId, onClose }: { poiId: string; onClose?: () => void }) {
  const poi = getPoi(poiId);
  const setPoint = useAstra((s) => s.setPoint);
  const addWaypoint = useAstra((s) => s.addWaypoint);
  const toggleAttractor = useAstra((s) => s.toggleAttractor);
  const attractors = useAstra((s) => s.attractorPoiIds);
  const navigate = useNavigate();
  if (!poi) return null;
  const loc = poi.location;

  return (
    <div className="panel p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="label">{poi.category}</div>
          <h3 className="text-base font-semibold">{poi.name}</h3>
          <div className="mt-1">
            <ClassBadge value={poi.dataClass} />
          </div>
        </div>
        {onClose && (
          <button className="btn" onClick={onClose} aria-label="Close inspector">
            <X size={15} />
          </button>
        )}
      </div>

      <p className="mt-3 leading-relaxed">{poi.significance}</p>

      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="label">Location</dt>
          <dd className="mt-0.5">
            {loc ? <span className="font-mono">{formatLonLat(loc, 2)}</span> : <span className="italic text-mute">No sourced coordinate</span>}
            <div className="mt-0.5 text-mute">{poi.locationSource}</div>
          </dd>
        </div>
        <div>
          <dt className="label">Related products</dt>
          <dd className="mt-0.5">{poi.products.join('; ')}</dd>
        </div>
        <div>
          <dt className="label">Limitations</dt>
          <dd className="mt-0.5">
            <ul className="list-disc space-y-0.5 pl-4">
              {poi.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="label">Sources</dt>
          <dd className="mt-0.5 space-y-0.5">
            {poi.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block text-rust-soft underline">
                {s.title}
              </a>
            ))}
          </dd>
        </div>
      </dl>

      {loc && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
          <button
            className="btn"
            onClick={() => {
              setPoint('start', loc);
              navigate('/planner');
            }}
          >
            Use as start
          </button>
          <button
            className="btn"
            onClick={() => {
              setPoint('destination', loc);
              navigate('/planner');
            }}
          >
            Use as destination
          </button>
          <button
            className="btn"
            onClick={() => {
              addWaypoint({ name: poi.name.split(' (')[0], location: loc, origin: 'poi', poiId: poi.id });
              navigate('/planner');
            }}
          >
            Add as stop
          </button>
          <button
            className={`btn ${attractors.includes(poi.id) ? 'btn-active' : ''}`}
            onClick={() => toggleAttractor(poi.id)}
            aria-pressed={attractors.includes(poi.id)}
            title="Science-focused routes are drawn toward attracting targets"
          >
            {attractors.includes(poi.id) ? 'Attracting science route' : 'Attract science route'}
          </button>
        </div>
      )}
    </div>
  );
}
