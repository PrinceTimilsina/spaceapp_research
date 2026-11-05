import type { TerrainGrid } from '../domain/grid';

/** Colour ramps shared by the map overlay, the Terrain page and the legends. */

export const SLOPE_CLASSES: { max: number; color: string; label: string }[] = [
  { max: 5, color: '#2f6f6a', label: '0–5°' },
  { max: 10, color: '#6ba35f', label: '5–10°' },
  { max: 15, color: '#d6c64a', label: '10–15°' },
  { max: 20, color: '#e8913a', label: '15–20°' },
  { max: 30, color: '#d9452b', label: '20–30°' },
  { max: Infinity, color: '#8a1f3d', label: '>30°' },
];

const ELEV_STOPS: [number, [number, number, number]][] = [
  [0, [28, 36, 74]],
  [0.35, [52, 98, 128]],
  [0.65, [182, 160, 96]],
  [1, [228, 120, 60]],
];

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

export function elevationColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < ELEV_STOPS.length; i++) {
    const [t1, c1] = ELEV_STOPS[i];
    const [t0, c0] = ELEV_STOPS[i - 1];
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return ELEV_STOPS[ELEV_STOPS.length - 1][1];
}

/** Renders the grid to a canvas (north up). Slope mode needs the slope array. No-data is transparent. */
export function renderGridCanvas(
  grid: TerrainGrid,
  mode: 'slope' | 'elevation',
  slope: Float32Array | null,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols;
  canvas.height = grid.rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const img = ctx.createImageData(grid.cols, grid.rows);
  let minE = Infinity;
  let maxE = -Infinity;
  for (const e of grid.elev) {
    if (!Number.isNaN(e)) {
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
    }
  }
  const classRgb = SLOPE_CLASSES.map((c) => hex(c.color));
  for (let i = 0; i < grid.elev.length; i++) {
    const e = grid.elev[i];
    let rgb: [number, number, number] | null = null;
    if (!Number.isNaN(e)) {
      if (mode === 'elevation') rgb = elevationColor((e - minE) / (maxE - minE || 1));
      else if (slope && !Number.isNaN(slope[i])) {
        const s = slope[i];
        rgb = classRgb[SLOPE_CLASSES.findIndex((c) => s < c.max)];
      }
    }
    const o = i * 4;
    if (rgb) {
      img.data[o] = rgb[0];
      img.data[o + 1] = rgb[1];
      img.data[o + 2] = rgb[2];
      img.data[o + 3] = 255;
    } else {
      img.data[o + 3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
