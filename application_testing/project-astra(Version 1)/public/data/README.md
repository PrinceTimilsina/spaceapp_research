# Optional data drop-in

- `dem/dem.meta.json` + `dem/dem.f32` — a real DEM; build with `pipeline/build_dem.py`. When present and valid, the planner uses it instead of the SIMULATED terrain.
- `geology/sim3464_units.geojson` — optional geologic units; build with `pipeline/convert_geology.sh`.

Nothing here ships with the app; no data is fabricated.
