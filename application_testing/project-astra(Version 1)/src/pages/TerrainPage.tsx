import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { useAstra } from '../store/useAstra';
import { gridStats } from '../domain/grid';
import { lonLatOf } from '../domain/grid';
import { formatLonLat } from '../domain/mars';
import { SLOPE_CLASSES, renderGridCanvas } from '../map/terrainRender';
import { Callout, ClassBadge, PageShell, Stat } from '../components/ui';

export default function TerrainPage() {
  const terrain = useAstra((s) => s.terrain);
  const [mode, setMode] = useState<'slope' | 'elevation'>('slope');
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const grid = terrain.grid;
  const slope = terrain.slope;

  const stats = useMemo(() => (grid && slope ? gridStats(grid, slope) : null), [grid, slope]);

  useEffect(() => {
    if (!grid || !canvasRef.current) return;
    const src = renderGridCanvas(grid, mode, slope);
    const c = canvasRef.current;
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')?.drawImage(src, 0, 0);
  }, [grid, slope, mode]);

  if (!grid || !slope || !stats) {
    return (
      <PageShell title="Terrain intelligence">
        <p className="text-mute">Preparing terrain grid…</p>
      </PageShell>
    );
  }

  const simulated = grid.source === 'simulated';
  const hoverInfo = (() => {
    if (!hover) return null;
    const i = hover.row * grid.cols + hover.col;
    return {
      pos: formatLonLat(lonLatOf(grid, hover.col, hover.row), 4),
      elev: grid.elev[i],
      slope: slope[i],
    };
  })();

  const total = stats.histogram.reduce((a, b) => a + b.count, 0) || 1;
  const bars = stats.histogram.map((h) => ({
    name: `${h.binStart}–${h.binEnd}°`,
    pct: Math.round((h.count / total) * 1000) / 10,
  }));

  return (
    <PageShell
      wide
      title="Terrain intelligence"
      intro={
        <>
          Elevation and slope of the grid the route planner uses.{' '}
          {simulated
            ? 'No real DEM file was found, so this is SIMULATED demonstration terrain.'
            : 'Slope is derived from the loaded DEM with Horn’s method.'}
        </>
      }
    >
      {simulated && (
        <div className="mb-6">
          <Callout tone="sim" title="This terrain is simulated, not Jezero">
            It is a procedurally generated surface so the pathfinding can be demonstrated end to end. To plan on real
            data, build a DEM from a USGS/NASA product with <code className="font-mono">pipeline/build_dem.py</code> and
            place the output in <code className="font-mono">public/data/dem/</code> (see the README). The elevation
            values below are relative synthetic metres.
          </Callout>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <section className="panel p-3" aria-label="Terrain raster">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClassBadge value={grid.dataClass} />
              <span className="text-sm text-mute">{grid.label}</span>
            </div>
            <div className="flex gap-1" role="group" aria-label="Display mode">
              {(['slope', 'elevation'] as const).map((m) => (
                <button key={m} className={`btn ${mode === m ? 'btn-active' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m === 'slope' ? 'Slope' : 'Elevation'}
                </button>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded bg-black">
            <canvas
              ref={canvasRef}
              className="block w-full"
              style={{ imageRendering: 'pixelated', aspectRatio: `${grid.cols} / ${grid.rows}` }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const col = Math.min(grid.cols - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * grid.cols)));
                const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * grid.rows)));
                setHover({ col, row });
              }}
              onMouseLeave={() => setHover(null)}
              role="img"
              aria-label={`${mode} raster of the planner terrain grid`}
            />
          </div>
          <div className="mt-2 min-h-[1.25rem] font-mono text-xs text-mute">
            {hoverInfo
              ? `${hoverInfo.pos} · elev ${Number.isNaN(hoverInfo.elev) ? 'no data' : hoverInfo.elev.toFixed(1) + ' m'}${simulated ? ' (SIMULATED)' : ''} · slope ${Number.isNaN(hoverInfo.slope) ? '—' : hoverInfo.slope.toFixed(1) + '°'}`
              : 'Hover the raster to read values at that cell.'}
          </div>
          {mode === 'slope' && (
            <ul className="mt-2 flex flex-wrap gap-3">
              {SLOPE_CLASSES.map((c) => (
                <li key={c.label} className="flex items-center gap-1.5 text-xs text-mute">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ background: c.color }} />
                  {c.label}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Grid" value={`${grid.cols} × ${grid.rows}`} />
            <Stat label="Cell size" value={`${grid.resolutionM} m`} hint="Nominal ground sampling distance" />
            <Stat label="Min elev" value={`${stats.minElev.toFixed(0)} m`} hint={simulated ? 'Relative, synthetic' : undefined} />
            <Stat label="Max elev" value={`${stats.maxElev.toFixed(0)} m`} hint={simulated ? 'Relative, synthetic' : undefined} />
            <Stat label="Mean slope" value={`${stats.meanSlope.toFixed(1)}°`} />
            <Stat label="Max slope" value={`${stats.maxSlope.toFixed(1)}°`} />
            <Stat label="No-data cells" value={stats.nodataCells.toLocaleString()} />
            <Stat label="Method" value="Horn 3×3" hint="Weighted finite differences over the 8 neighbours" />
          </div>

          <div className="panel p-3">
            <div className="label mb-2">Share of cells by slope</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke="#272b31" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#8c929a', fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fill: '#8c929a', fontSize: 10 }} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#141619', border: '1px solid #272b31', fontSize: 12 }}
                    formatter={(v) => [`${v}%`, 'cells']}
                  />
                  <Bar dataKey="pct" fill="#d9632b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] text-mute">Slopes above 40° are counted in the last bin.</p>
          </div>

          <div className="panel p-3 text-xs leading-relaxed">
            <div className="label mb-1">Provenance</div>
            <p>{grid.provenance}</p>
            <div className="label mb-1 mt-3">Limitations</div>
            <ul className="list-disc space-y-1 pl-4">
              {grid.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
              <li>
                Slope is derived at the grid resolution only; it cannot reveal rocks, small craters or soft ground.
              </li>
            </ul>
            <p className="mt-3">
              Explore this grid on the <Link to="/map" className="text-rust-soft underline">Map</Link> (Terrain layers) or
              route across it in the <Link to="/planner" className="text-rust-soft underline">Planner</Link>.
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
