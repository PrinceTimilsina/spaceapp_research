import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { LAYERS, type LayerConfig } from '../data/layers';
import { getDataset } from '../data/registry';
import { useGeology, unitColor } from '../data/useGeology';
import { useAstra } from '../store/useAstra';
import { SLOPE_CLASSES } from './terrainRender';
import { ClassBadge, DatasetDetails } from '../components/ui';

const GROUPS: { id: LayerConfig['group']; title: string }[] = [
  { id: 'base', title: 'Basemap' },
  { id: 'imagery', title: 'Orbital imagery' },
  { id: 'terrain', title: 'Terrain (planner grid)' },
  { id: 'vector', title: 'Vectors & overlays' },
];

function statusText(l: LayerConfig, status: string): { text: string; cls: string } | null {
  if (!l.tile) return null;
  if (status === 'ok') return { text: 'tiles received', cls: 'text-obs' };
  if (status === 'unavailable')
    return { text: 'no tiles returned (outside coverage or service unreachable)', cls: 'text-der' };
  return { text: 'waiting for tiles…', cls: 'text-mute' };
}

export default function LayerPanel() {
  const layers = useAstra((s) => s.layers);
  const setVisible = useAstra((s) => s.setLayerVisible);
  const setOpacity = useAstra((s) => s.setLayerOpacity);
  const terrain = useAstra((s) => s.terrain);
  const geology = useGeology();
  const [info, setInfo] = useState<LayerConfig | null>(null);

  const simulated = terrain.grid?.source === 'simulated';

  return (
    <div className="space-y-4 p-3">
      {GROUPS.map((g) => (
        <section key={g.id} aria-label={g.title}>
          <h3 className="label mb-2">{g.title}</h3>
          <ul className="space-y-2">
            {LAYERS.filter((l) => l.group === g.id).map((l) => {
              const st = layers[l.id];
              const tag = statusText(l, st.status);
              const ds = l.datasetId ? getDataset(l.datasetId) : undefined;
              const isTerrain = l.group === 'terrain' || l.id === 'terrain-extent';
              return (
                <li key={l.id} className="rounded-md border border-line bg-panel2 p-2">
                  <div className="flex items-start gap-2">
                    <input
                      id={`layer-${l.id}`}
                      type="checkbox"
                      className="mt-1 accent-[#d9632b]"
                      checked={st.visible}
                      onChange={(e) => setVisible(l.id, e.target.checked)}
                    />
                    <label htmlFor={`layer-${l.id}`} className="min-w-0 flex-1 cursor-pointer text-sm leading-tight">
                      {l.name}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {ds && <ClassBadge value={ds.dataClass} />}
                        {isTerrain && simulated && <ClassBadge value="SIMULATED" />}
                      </div>
                    </label>
                    <button
                      className="rounded p-1 text-mute hover:text-rust-soft"
                      onClick={() => setInfo(l)}
                      aria-label={`About ${l.name}`}
                      title="Layer details and provenance"
                    >
                      <Info size={15} />
                    </button>
                  </div>
                  {tag && st.visible && <div className={`mt-1 pl-6 text-[11px] ${tag.cls}`}>{tag.text}</div>}
                  {st.visible && (l.tile || l.group === 'terrain' || l.id === 'geology') && (
                    <div className="mt-2 flex items-center gap-2 pl-6">
                      <span className="text-[11px] text-mute">Opacity</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={st.opacity}
                        aria-label={`${l.name} opacity`}
                        onChange={(e) => setOpacity(l.id, Number(e.target.value))}
                        className="h-1 flex-1 accent-[#d9632b]"
                      />
                    </div>
                  )}
                  {st.visible && l.legend && (
                    <ul className="mt-2 space-y-0.5 pl-6">
                      {l.legend.map((x) => (
                        <li key={x.label} className="flex items-center gap-2 text-[11px] text-mute">
                          <span
                            className="inline-block h-0 w-5 border-t-2"
                            style={{ borderColor: x.color, borderStyle: x.dashed ? 'dashed' : 'solid' }}
                          />
                          {x.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {l.id === 'slope' && st.visible && (
                    <ul className="mt-2 grid grid-cols-3 gap-x-2 gap-y-0.5 pl-6">
                      {SLOPE_CLASSES.map((c) => (
                        <li key={c.label} className="flex items-center gap-1 text-[11px] text-mute">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {l.id === 'geology' && (
                    <div className="mt-2 pl-6 text-[11px] text-mute">
                      {geology.status === 'present' ? (
                        geology.units.length > 0 ? (
                          <ul className="max-h-28 space-y-0.5 overflow-auto">
                            {geology.units.map((u) => (
                              <li key={u} className="flex items-center gap-1.5">
                                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: unitColor(u) }} />
                                {u}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          'Loaded; no unit-name attribute detected.'
                        )
                      ) : geology.status === 'invalid' ? (
                        'File found but is not a valid GeoJSON FeatureCollection.'
                      ) : geology.status === 'loading' ? (
                        'Checking for file…'
                      ) : (
                        'Not loaded: add public/data/geology/sim3464_units.geojson (see README).'
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {info && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${info.name} details`}
          onClick={() => setInfo(null)}
        >
          <div
            className="panel max-h-[85vh] w-full max-w-2xl overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{info.name}</h2>
                <p className="mt-1 text-sm text-mute">{info.description}</p>
              </div>
              <button className="btn" onClick={() => setInfo(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            {info.datasetId && getDataset(info.datasetId) ? (
              <DatasetDetails d={getDataset(info.datasetId)!} />
            ) : (
              <p className="text-sm text-ink/90">
                This layer is generated by PROJECT ASTRA from the active planner terrain grid or from your inputs; it
                does not come from a separate external dataset.
                {simulated && ' The grid is currently SIMULATED, so everything drawn from it is a demonstration only.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
