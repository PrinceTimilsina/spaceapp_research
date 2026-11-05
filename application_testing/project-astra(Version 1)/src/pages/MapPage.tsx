import { useState } from 'react';
import { Layers, PanelLeftClose } from 'lucide-react';
import MapView from '../map/MapView';
import LayerPanel from '../map/LayerPanel';
import PoiInspector from '../components/PoiInspector';
import { useAstra } from '../store/useAstra';
import { MAPPABLE_POIS } from '../data/pois';
import { ClassBadge } from '../components/ui';

export default function MapPage() {
  const [open, setOpen] = useState(true);
  const selectedPoiId = useAstra((s) => s.selectedPoiId);
  const selectPoi = useAstra((s) => s.selectPoi);
  const focusOn = useAstra((s) => s.focusOn);
  const terrain = useAstra((s) => s.terrain);
  const pickMode = useAstra((s) => s.pickMode);
  const setPickMode = useAstra((s) => s.setPickMode);
  const simulated = terrain.grid?.source === 'simulated';

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      <aside
        className={`absolute inset-y-0 left-0 z-20 w-[19rem] max-w-[88vw] overflow-y-auto border-r border-line bg-bg transition-transform md:static md:max-w-none md:shrink-0 ${
          open ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
        aria-label="Layers"
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Layers size={15} /> Layers
          </div>
          <button className="btn" onClick={() => setOpen(false)} aria-label="Hide layers panel">
            <PanelLeftClose size={15} />
          </button>
        </div>
        <LayerPanel />
      </aside>

      <div className="relative min-w-0 flex-1">
        <MapView className="h-full w-full" />

        {!open && (
          <button className="btn absolute left-3 top-3 z-10 bg-bg/90" onClick={() => setOpen(true)}>
            <Layers size={15} /> Layers
          </button>
        )}

        <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-6rem)] flex-wrap justify-end gap-2">
          {MAPPABLE_POIS.map((p) => (
            <button
              key={p.id}
              className="btn bg-bg/90 text-xs"
              onClick={() => {
                if (p.location) focusOn(p.location.lon, p.location.lat, 12);
                selectPoi(p.id);
              }}
            >
              {p.name.split(' (')[0]}
            </button>
          ))}
          {pickMode && (
            <button className="btn btn-active bg-bg/90 text-xs" onClick={() => setPickMode(null)}>
              Cancel picking
            </button>
          )}
        </div>

        {simulated && (
          <div className="pointer-events-none absolute bottom-2 right-2 z-10 hidden items-center gap-2 rounded bg-bg/90 px-2 py-1 text-xs sm:flex">
            <ClassBadge value="SIMULATED" /> Terrain overlays are demonstration data, not Jezero topography.
          </div>
        )}

        {selectedPoiId && (
          <div className="absolute inset-x-2 bottom-12 z-20 max-h-[55%] overflow-auto sm:inset-x-auto sm:right-3 sm:top-14 sm:bottom-auto sm:max-h-[calc(100%-7rem)] sm:w-[24rem]">
            <PoiInspector poiId={selectedPoiId} onClose={() => selectPoi(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
