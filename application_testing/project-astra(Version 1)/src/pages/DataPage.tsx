import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DATASETS } from '../data/registry';
import { GLOBAL_LIMITATIONS, PROTOTYPE_NOTICE } from '../data/site';
import { useAstra } from '../store/useAstra';
import { Callout, ClassBadge, DATA_CLASS_INFO, DatasetDetails, IntegrationTag, PageShell } from '../components/ui';
import type { DataClass } from '../types';

export default function DataPage() {
  const [open, setOpen] = useState<string | null>(null);
  const terrain = useAstra((s) => s.terrain);
  const layers = useAstra((s) => s.layers);

  return (
    <PageShell
      title="Data, provenance & limitations"
      intro="Every dataset the app uses or references, with what is known, what is not recorded, and what was actually verified while building it. Unknown values are shown as “not recorded”, never guessed."
    >
      <div className="space-y-6">
        <Callout tone="warn" title="Read this first">
          {PROTOTYPE_NOTICE}
        </Callout>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Terrain status in this session</h2>
          <div className="panel p-4 text-sm">
            <p>
              {terrain.status === 'loading'
                ? 'Loading…'
                : `${terrain.grid?.label ?? ''}: ${terrain.note}`}
            </p>
            {terrain.grid && <p className="mt-2 text-xs text-mute">{terrain.grid.provenance}</p>}
            <p className="mt-3 text-xs text-mute">
              Live tile checks this session:{' '}
              {['viking', 'ctx', 'hirise', 'themis']
                .map((id) => `${id} → ${layers[id].status === 'ok' ? 'tiles received' : layers[id].status === 'unavailable' ? 'none returned' : 'not requested yet'}`)
                .join(' · ')}
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Classification used throughout</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(DATA_CLASS_INFO) as DataClass[]).map((k) => (
              <li key={k} className="panel p-3 text-sm">
                <ClassBadge value={k} />
                <p className="mt-1.5 text-ink/90">{DATA_CLASS_INFO[k].meaning}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Dataset registry</h2>
          <ul className="space-y-2">
            {DATASETS.map((d) => {
              const isOpen = open === d.id;
              return (
                <li key={d.id} className="panel">
                  <button
                    className="flex w-full items-start gap-3 p-3 text-left"
                    aria-expanded={isOpen}
                    aria-controls={`ds-${d.id}`}
                    onClick={() => setOpen(isOpen ? null : d.id)}
                  >
                    <ChevronDown size={16} className={`mt-1 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{d.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <ClassBadge value={d.dataClass} />
                        <IntegrationTag value={d.integration} />
                        <span className="text-xs text-mute">{d.provider}</span>
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div id={`ds-${d.id}`} className="border-t border-line p-4">
                      <DatasetDetails d={d} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Global limitations</h2>
          <ul className="panel list-disc space-y-2 p-4 pl-9 text-sm">
            {GLOBAL_LIMITATIONS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
