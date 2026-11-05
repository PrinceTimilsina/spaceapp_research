#!/usr/bin/env python3
"""
Convert a real Mars DEM (GeoTIFF) into the format PROJECT ASTRA loads:
  public/data/dem/dem.f32        float32 little-endian, row 0 = NORTH
  public/data/dem/dem.meta.json  metadata (provenance is REQUIRED, nothing is guessed)

Requires GDAL Python bindings / CLI (apt install gdal-bin python3-gdal).

Example (values below are placeholders - fill in from the product's own page):
  python3 pipeline/build_dem.py input.tif \
      --name "My Jezero DTM" --product-id "<official product id>" \
      --provider "<who produced it>" --source-url "<landing page URL>" \
      --west 77.2 --south 18.1 --east 77.9 --north 18.7 --cell-size 100 \
      --vertical-datum "<as stated in product docs>" \
      --acquisition "<as stated in product docs>" --license "<as stated>"
"""
import argparse, json, math, os, subprocess, sys, tempfile

R = 3396190.0  # Mars 2000 sphere radius used throughout ASTRA
NODATA = -9999.0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("input")
    p.add_argument("--out-dir", default="public/data/dem")
    for k in ("name", "product-id", "provider", "source-url", "vertical-datum", "acquisition", "license"):
        p.add_argument(f"--{k}", required=True)
    for k in ("west", "south", "east", "north"):
        p.add_argument(f"--{k}", type=float, required=True)
    p.add_argument("--cell-size", type=float, required=True, help="target cell size in metres")
    p.add_argument("--resample", default="bilinear", choices=["near", "bilinear", "cubic"])
    p.add_argument("--src-srs", default=None, help="override if the GeoTIFF lacks a usable CRS")
    a = p.parse_args()

    if not (a.east > a.west and a.north > a.south):
        sys.exit("bounds are inverted")
    mid = (a.north + a.south) / 2
    m_per_deg = R * math.pi / 180
    d_lat = a.cell_size / m_per_deg
    d_lon = d_lat / math.cos(math.radians(mid))
    cols = max(2, round((a.east - a.west) / d_lon))
    rows = max(2, round((a.north - a.south) / d_lat))
    os.makedirs(a.out_dir, exist_ok=True)

    with tempfile.TemporaryDirectory() as td:
        warped = os.path.join(td, "warped.tif")
        cmd = ["gdalwarp", "-overwrite", "-t_srs", f"+proj=longlat +R={R:.0f} +no_defs",
               "-te", str(a.west), str(a.south), str(a.east), str(a.north),
               "-ts", str(cols), str(rows), "-r", a.resample,
               "-dstnodata", str(NODATA), "-ot", "Float32"]
        if a.src_srs:
            cmd += ["-s_srs", a.src_srs]
        cmd += [a.input, warped]
        subprocess.run(cmd, check=True)
        raw = os.path.join(td, "dem.raw")
        # ENVI/raw output is north-first, little-endian float32 on x86/ARM.
        subprocess.run(["gdal_translate", "-of", "ENVI", "-ot", "Float32", warped, raw], check=True)
        out = os.path.join(a.out_dir, "dem.f32")
        with open(raw, "rb") as s, open(out, "wb") as d:
            d.write(s.read())
    if sys.byteorder != "little":
        sys.exit("big-endian host: byte-swap the output before use")
    if os.path.getsize(out) != cols * rows * 4:
        sys.exit("unexpected output size")

    meta = {
        "schema": 1, "name": a.name, "productId": a.product_id, "provider": a.provider,
        "sourceUrl": a.source_url,
        "bounds": {"west": a.west, "south": a.south, "east": a.east, "north": a.north},
        "cols": cols, "rows": rows, "cellSizeM": a.cell_size, "elevationUnits": "m",
        "nodata": NODATA, "verticalDatum": a.vertical_datum,
        "processing": f"gdalwarp to +proj=longlat +R={R:.0f} ({a.resample}), {cols}x{rows} cells; produced by pipeline/build_dem.py",
        "acquisition": a.acquisition, "license": a.license,
        "limitations": [
            "Resampled from the source product; fine detail below the target cell size is lost.",
            "Slope is derived by ASTRA (Horn's method) and depends on resolution and DEM quality.",
        ],
        "file": "dem.f32",
    }
    with open(os.path.join(a.out_dir, "dem.meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(f"wrote {out} ({cols}x{rows}) and dem.meta.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
