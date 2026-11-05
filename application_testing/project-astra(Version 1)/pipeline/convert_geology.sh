#!/usr/bin/env bash
# Convert a USGS geologic map (shapefile / geodatabase / GeoPackage) to GeoJSON in lon/lat degrees
# so the Map page can show it as an optional OBSERVED-interpretation overlay.
# Usage: pipeline/convert_geology.sh <input> [layer]
# Requires GDAL (apt install gdal-bin). The unit-name field differs by product; the viewer auto-detects it.
set -euo pipefail
in="${1:?usage: convert_geology.sh <input> [layer]}"
out="public/data/geology/sim3464_units.geojson"
mkdir -p "$(dirname "$out")"
rm -f "$out"
ogr2ogr -f GeoJSON "$out" "$in" ${2:+"$2"} \
  -t_srs "+proj=longlat +R=3396190 +no_defs" -lco RFC7946=NO -lco COORDINATE_PRECISION=6
echo "wrote $out"
