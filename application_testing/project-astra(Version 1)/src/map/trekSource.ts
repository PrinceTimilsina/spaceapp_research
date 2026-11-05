import TileGrid from 'ol/tilegrid/TileGrid';
import XYZ from 'ol/source/XYZ';
import type ImageTile from 'ol/ImageTile';
import type { TileSpec } from '../data/layers';
import { MARS_EXTENT, MARS_PROJECTION } from './marsProjection';

/**
 * NASA Trek equirectangular WMTS pyramid: level 0 is 2 columns x 1 row of 256 px tiles covering
 * [-180,180] x [-90,90]; row 0 is the north edge; each level doubles the resolution.
 * (Matches the TileMatrix definitions in the Trek WMTS capabilities: top-left -180/90, 256 px tiles.)
 */
export const LEVEL0_RES = 360 / (2 * 256); // degrees per pixel at level 0

export function trekTileGrid(maxZoom: number): TileGrid {
  const resolutions = Array.from({ length: maxZoom + 1 }, (_, z) => LEVEL0_RES / 2 ** z);
  return new TileGrid({ extent: MARS_EXTENT, origin: [-180, 90], resolutions, tileSize: 256 });
}

function fill(template: string, z: number, x: number, y: number): string {
  return template.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x));
}

function swapExt(url: string, ext: string): string {
  return url.replace(/\.(png|jpg)$/i, `.${ext}`);
}

/**
 * Creates a tile source that tries each candidate endpoint and extension until one answers, then
 * sticks with the working combination. Missing tiles (HTTP 404) are how Trek signals "no coverage".
 * `crossOrigin` is deliberately NOT set: tiles are only drawn, never read back, and forcing CORS
 * would make otherwise-valid tiles fail on servers without CORS headers.
 */
export function createTrekSource(spec: TileSpec, report: (ok: boolean) => void): XYZ {
  let working: string | null = null; // "candidateIndex:ext"

  const variants = (z: number, x: number, y: number): { key: string; url: string }[] => {
    const out: { key: string; url: string }[] = [];
    spec.candidates.forEach((tpl, ci) => {
      for (const ext of spec.extensions) out.push({ key: `${ci}:${ext}`, url: swapExt(fill(tpl, z, x, y), ext) });
    });
    if (working) {
      const hit = out.find((v) => v.key === working);
      if (hit) return [hit];
    }
    return out;
  };

  return new XYZ({
    projection: MARS_PROJECTION,
    tileGrid: trekTileGrid(spec.maxNativeZoom),
    wrapX: false,
    maxZoom: spec.maxNativeZoom,
    tileUrlFunction: (tc) => (tc ? fill(spec.candidates[0], tc[0], tc[1], tc[2]) : undefined),
    tileLoadFunction: (tile, src) => {
      const t = tile as ImageTile;
      const img = t.getImage() as HTMLImageElement;
      const tc = t.getTileCoord();
      const list = variants(tc[0], tc[1], tc[2]);
      if (list.length === 0) {
        img.src = src;
        return;
      }
      let k = 0;
      const attempt = () => {
        const probe = new Image();
        probe.onload = () => {
          working = list[k].key;
          report(true);
          img.src = list[k].url;
        };
        probe.onerror = () => {
          k++;
          if (k < list.length) attempt();
          else {
            report(false);
            img.src = list[0].url; // let OpenLayers register the failure
          }
        };
        probe.src = list[k].url;
      };
      attempt();
    },
  });
}
