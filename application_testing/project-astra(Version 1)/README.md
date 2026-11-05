# PROJECT ASTRA

Interactive, science-grounded Jezero Crater (Mars) exploration and mission-planning guide, built for the NASA Space Apps Challenge 2026.

React 18+ / TypeScript / Vite · OpenLayers · Zustand · Tailwind · A* pathfinding in a Web Worker · Vitest + Playwright.

> **Read this first.** ASTRA is a hypothetical-planning and education tool. It is not affiliated with or endorsed by NASA, and it is **not** a safety or flight-planning tool. Nothing in it is a safety assessment.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Requires Node 20+.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the build (port 4173) |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser smoke tests (Playwright). First run: `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_PATH` to an existing Chromium |

## What is in the app

- **Map** – OpenLayers map in a custom Mars 2000 equirectangular projection (no Earth geodesics). Toggle Viking / THEMIS / CTX / HiRISE tiles from NASA Trek, slope and elevation overlays, graticule, scale bar, sourced points of interest, optional geology. Each layer has a provenance dialog.
- **Terrain** – slope classes and statistics for the active terrain grid.
- **Science** – guide to Jezero science themes and mission objectives.
- **Planner** – A* routing on an 8-connected grid with directed costs (climbing costs more than descending). Strategies: shortest, terrain-conscious, science-focused. Outbound and return are planned separately and compared; a retrace is offered when return = start. Mobility profiles are planning assumptions.
- **Environment** – context only; it deliberately shows no measured values.
- **Field guide** – printable summary (Print / save as PDF) and JSON export of the current plan.
- **Data & limits** – dataset registry with verification status, and global limitations.

## Data honesty

Every dataset and feature carries one of four classes: **OBSERVED**, **DERIVED**, **MODELLED**, **SIMULATED**.

- **Planner terrain is SIMULATED by default.** No real DEM is bundled. The synthetic surface (100 m cells) exists only to demonstrate the algorithm, and the UI, field guide and exports say so. To use real terrain, supply a DEM (below).
- **Imagery** comes from NASA Mars Trek WMTS tiles fetched live by your browser. The Viking MDIM 2.1 layer id and tile scheme were taken from public Trek documentation. The **Jezero CTX, HiRISE and THEMIS layer ids are not verified** — they are probed at runtime with host/extension fallbacks, and the layer panel shows "tiles received" or "no tiles returned". If a layer fails, correct its id in `src/data/layers.ts` (find the real id from the Trek WMTS capabilities document, see `src/data/registry.ts` for the source links).
- **Points of interest**: only places with a sourced coordinate are mapped (Jezero crater, Octavia E. Butler Landing). The rest are described but unmapped (`location: null`) rather than guessed. Coordinates come from a secondary source; check the `locationSource` string.
- **Geology polygons** are not bundled; see below.
- No 3D view is included.
- Terrain burden is a relative effort index (% over flat ground), never a safety score.

### Supplying a real DEM

1. Download a Jezero DTM (e.g. a USGS Astrogeology / HiRISE / CTX DTM product) and note its official product id, provider, URL, vertical datum, acquisition and license.
2. Convert (needs GDAL):
   ```bash
   python3 pipeline/build_dem.py input.tif --name "..." --product-id "..." --provider "..." \
     --source-url "..." --vertical-datum "..." --acquisition "..." --license "..." \
     --west 77.2 --south 18.1 --east 77.9 --north 18.7 --cell-size 100
   ```
   This writes `public/data/dem/dem.f32` and `dem.meta.json`. Provenance arguments are required — the app displays them, and none are invented.
3. Reload. The planner switches from SIMULATED to your DEM, and slope is derived with Horn's method.

### Geology overlay

```bash
pipeline/convert_geology.sh path/to/geologic_map.shp
```
Writes `public/data/geology/sim3464_units.geojson`, which the Map page picks up automatically.

## Planning model

`stepCost = distance × (1 + w × penalty)`, `penalty = (slope/maxSlope)² + uphillWeight × max(0, rise/run)`. Edges steeper than the profile limit are impassable; no-data cells are never crossed. The science strategy applies a bounded per-cell discount near selected targets; its heuristic stays admissible. Distances use planar math on the Mars radius 3,396,190 m.

Profiles (assumptions, not specifications): conservative 12°, standard 20°, capable 30°.

## Deployment

The app is fully static, uses `HashRouter` and `base: './'`, so it works on any static host or subpath.

```bash
npm run build
```
Upload `dist/` to Netlify, Vercel (static), Cloudflare Pages, S3, or GitHub Pages (publish `dist/` to the `gh-pages` branch). Tiles are requested from NASA by the visitor's browser; check Trek's current usage terms and CORS behavior from your deployed origin.

## Project structure

```
src/
  domain/      Mars constants, grid, slope, simulated terrain, cost model, A*, planner, DEM loader (+ tests)
  data/        dataset registry, layer config, POIs, site text, geology loader
  store/       Zustand store
  workers/     route worker + client with main-thread fallback
  map/         OpenLayers projection, Trek sources, terrain rendering, MapView, LayerPanel
  components/  layout, shared UI, inspector, route tables, SVG route schematic
  pages/       Home, Map, Terrain, Science, Planner, Environment, FieldGuide, Data
pipeline/      build_dem.py, convert_geology.sh
e2e/           Playwright smoke tests
public/data/   optional DEM / geology drop-in
```

## Known limitations

- Real terrain, geology and several imagery layers require your action or a live network check (see above).
- The main JS bundle is ~1.1 MB (OpenLayers + Recharts).
- Unit and e2e tests cover logic and navigation, not scientific validity of routes on real terrain.

## Credits

Imagery: NASA/JPL, USGS Astrogeology, NASA Mars Trek. Data classes and attributions are listed per dataset in-app (Data & limits). Code: MIT, see `LICENSE`.
