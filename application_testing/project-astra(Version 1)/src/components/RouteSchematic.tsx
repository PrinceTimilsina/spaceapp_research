import { useMemo } from 'react';
import type { TerrainGrid } from '../domain/grid';
import type { PlanBundle } from '../domain/routePlanner';
import { DEG } from '../domain/mars';
import { renderGridCanvas } from '../map/terrainRender';
import { STRATEGY_COLORS } from '../data/layers';
import { STRATEGIES, STRATEGY_INFO } from '../domain/costModel';
import type { LonLat, Waypoint } from '../types';

/**
 * Vector route schematic (SVG). Used by the Field Guide so the printout never depends on map tiles
 * (which cannot be captured from cross-origin canvases). The backdrop is the slope raster of the active grid.
 */
export default function RouteSchematic({
  grid,
  slope,
  bundle,
  start,
  destination,
  returnPoint,
  waypoints,
}: {
  grid: TerrainGrid;
  slope: Float32Array | null;
  bundle: PlanBundle | null;
  start: LonLat | null;
  destination: LonLat | null;
  returnPoint: LonLat | null;
  waypoints: Waypoint[];
}) {
  const cosLat = Math.cos(((grid.south + grid.north) / 2) * DEG);
  const W = 1000;
  const spanX = (grid.east - grid.west) * cosLat;
  const spanY = grid.north - grid.south;
  const H = (W * spanY) / spanX;
  const px = (p: LonLat) => ({ x: ((p.lon - grid.west) * cosLat * W) / spanX, y: ((grid.north - p.lat) * H) / spanY });

  const bg = useMemo(() => renderGridCanvas(grid, 'slope', slope).toDataURL('image/png'), [grid, slope]);

  const line = (coords: LonLat[]) => coords.map((c) => px(c)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const marker = (p: LonLat | null, label: string, color: string) => {
    if (!p) return null;
    const { x, y } = px(p);
    return (
      <g key={label + x}>
        <circle cx={x} cy={y} r={9} fill={color} stroke="#000" strokeWidth={2} />
        <text x={x + 13} y={y - 11} fontSize={22} fontWeight={600} fill="#fff" stroke="#000" strokeWidth={4} paintOrder="stroke">
          {label}
        </text>
      </g>
    );
  };

  return (
    <figure className="print-avoid-break">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Route schematic over the slope raster of the planner terrain grid"
        className="keep-bg w-full rounded border border-line bg-black"
      >
        <image href={bg} x={0} y={0} width={W} height={H} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
        {bundle &&
          STRATEGIES.map((s) => {
            const o = bundle.outbound[s];
            const r = bundle.returns[s];
            return (
              <g key={s} fill="none" strokeLinejoin="round" strokeLinecap="round">
                {o.found && <path d={line(o.coordinates)} stroke={STRATEGY_COLORS[s]} strokeWidth={5} />}
                {r.found && <path d={line(r.coordinates)} stroke={STRATEGY_COLORS[s]} strokeWidth={4} strokeDasharray="14 10" />}
              </g>
            );
          })}
        {waypoints.map((w, i) => marker(w.location, `${i + 1}. ${w.name}`, '#e7e4df'))}
        {marker(returnPoint, 'Return', '#8ab4f8')}
        {marker(start, 'Start', '#7fd1a0')}
        {marker(destination, 'Destination', '#f2a65a')}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
        <span>North up. Backdrop: slope raster ({grid.source === 'simulated' ? 'SIMULATED' : 'derived from DEM'}).</span>
        {STRATEGIES.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: STRATEGY_COLORS[s] }} />
            {STRATEGY_INFO[s].name}
          </span>
        ))}
        <span>Solid = outbound, dashed = return.</span>
      </figcaption>
    </figure>
  );
}
