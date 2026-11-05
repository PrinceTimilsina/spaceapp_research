/**
 * Map layer configuration. Data access is kept separate from UI: add a layer here and the layer panel,
 * legend, metadata drawer and attribution pick it up automatically.
 */

export interface TileSpec {
  /** Tile URL templates tried in order until one succeeds. Placeholders: {z} {y} {x} (row-major, y down). */
  candidates: string[];
  /** Highest tile matrix level believed to hold native data; deeper zooms overscale this level. */
  maxNativeZoom: number;
  /** Preferred extension first. The loader retries the other one if a tile fails. */
  extensions: ['png', 'jpg'] | ['jpg', 'png'];
}

export interface LayerConfig {
  id: string;
  name: string;
  group: 'base' | 'imagery' | 'terrain' | 'vector';
  datasetId: string | null;
  defaultVisible: boolean;
  defaultOpacity: number;
  description: string;
  tile?: TileSpec;
  /** Vector legend swatches. */
  legend?: { label: string; color: string; dashed?: boolean }[];
}

const API = 'https://api.nasa.gov/mars-wmts/catalog';
const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const TAIL = '1.0.0/default/default028mm/{z}/{y}/{x}';

export const VIKING_LAYER = 'Mars_Viking_MDIM21_ClrMosaic_global_232m';
export const THEMIS_LAYER = 'Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v12_clon0_ly';
export const JEZERO_CTX_LAYER = 'Jezero_CTX_BlockAdj_dd';
export const JEZERO_HIRISE_LAYER = 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd';

export const LAYERS: LayerConfig[] = [
  {
    id: 'viking',
    name: 'Viking MDIM 2.1 colour mosaic',
    group: 'base',
    datasetId: 'trek-viking-mdim21',
    defaultVisible: true,
    defaultOpacity: 1,
    description: 'Global regional-context basemap (232 m/px).',
    tile: { candidates: [`${API}/${VIKING_LAYER}/${TAIL}.jpg`], maxNativeZoom: 7, extensions: ['jpg', 'png'] },
  },
  {
    id: 'themis',
    name: 'THEMIS IR daytime mosaic',
    group: 'imagery',
    datasetId: 'trek-themis-ir-day',
    defaultVisible: false,
    defaultOpacity: 0.85,
    description: 'Thermal-infrared snapshot (not live, not weather). Brightness only; no temperatures are derived.',
    tile: { candidates: [`${API}/${THEMIS_LAYER}/${TAIL}.jpg`], maxNativeZoom: 8, extensions: ['jpg', 'png'] },
  },
  {
    id: 'ctx',
    name: 'CTX mosaic - Jezero (~6 m/px)',
    group: 'imagery',
    datasetId: 'trek-jezero-ctx',
    defaultVisible: true,
    defaultOpacity: 1,
    description: 'Regional detail. Visible where the Trek service provides tiles.',
    tile: {
      candidates: [`${TREK}/${JEZERO_CTX_LAYER}/${TAIL}.png`, `${API}/${JEZERO_CTX_LAYER}/${TAIL}.png`],
      maxNativeZoom: 12,
      extensions: ['png', 'jpg'],
    },
  },
  {
    id: 'hirise',
    name: 'HiRISE orthomosaic (~25 cm/px)',
    group: 'imagery',
    datasetId: 'trek-jezero-hirise',
    defaultVisible: true,
    defaultOpacity: 1,
    description: 'Local detail. Limited footprint near the landing site / crater floor.',
    tile: {
      candidates: [`${TREK}/${JEZERO_HIRISE_LAYER}/${TAIL}.png`, `${API}/${JEZERO_HIRISE_LAYER}/${TAIL}.png`],
      maxNativeZoom: 17,
      extensions: ['png', 'jpg'],
    },
  },
  {
    id: 'slope',
    name: 'Slope (derived from terrain grid)',
    group: 'terrain',
    datasetId: null,
    defaultVisible: false,
    defaultOpacity: 0.6,
    description:
      'Horn-method slope in degrees computed from the active terrain grid. SIMULATED unless a real DEM is loaded.',
  },
  {
    id: 'elevation',
    name: 'Elevation (terrain grid)',
    group: 'terrain',
    datasetId: null,
    defaultVisible: false,
    defaultOpacity: 0.6,
    description: 'Colour-coded elevation of the active terrain grid. Relative synthetic metres when SIMULATED.',
  },
  {
    id: 'graticule',
    name: 'Lon/lat graticule',
    group: 'vector',
    datasetId: null,
    defaultVisible: true,
    defaultOpacity: 0.5,
    description: 'Planetocentric longitude (east positive) and latitude, every 0.1°.',
  },
  {
    id: 'terrain-extent',
    name: 'Planner terrain coverage',
    group: 'vector',
    datasetId: null,
    defaultVisible: true,
    defaultOpacity: 0.9,
    description: 'Extent of the elevation grid used by the route planner (SIMULATED unless a real DEM is loaded).',
    legend: [{ label: 'Terrain grid footprint', color: '#e06c5a', dashed: true }],
  },
  {
    id: 'usgs-footprint',
    name: 'USGS SIM 3464 map footprint',
    group: 'vector',
    datasetId: 'usgs-sim3464',
    defaultVisible: true,
    defaultOpacity: 0.9,
    description: 'Published bounds of the USGS geologic map (≈1°×1°).',
    legend: [{ label: 'SIM 3464 footprint', color: '#d6a84a', dashed: true }],
  },
  {
    id: 'geology',
    name: 'USGS geologic units (optional file)',
    group: 'vector',
    datasetId: 'usgs-sim3464',
    defaultVisible: true,
    defaultOpacity: 0.45,
    description:
      'Appears only if public/data/geology/sim3464_units.geojson exists (see pipeline/convert_geology.sh). Original unit names are preserved.',
  },
  {
    id: 'pois',
    name: 'Science points of interest',
    group: 'vector',
    datasetId: 'poi-cited-coordinates',
    defaultVisible: true,
    defaultOpacity: 1,
    description: 'Sourced points of interest that have a verified coordinate.',
    legend: [{ label: 'Sourced point of interest', color: '#5fb3a1' }],
  },
  {
    id: 'plan',
    name: 'Mission plan and routes',
    group: 'vector',
    datasetId: null,
    defaultVisible: true,
    defaultOpacity: 1,
    description: 'Start, destination, stops and generated routes.',
    legend: [
      { label: 'Shortest', color: '#8ab4f8' },
      { label: 'Terrain-conscious', color: '#f2a65a' },
      { label: 'Science-focused', color: '#7fd1a0' },
    ],
  },
];

export function layerById(id: string): LayerConfig {
  const l = LAYERS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown layer ${id}`);
  return l;
}

export const STRATEGY_COLORS = {
  shortest: '#8ab4f8',
  terrain: '#f2a65a',
  science: '#7fd1a0',
} as const;
