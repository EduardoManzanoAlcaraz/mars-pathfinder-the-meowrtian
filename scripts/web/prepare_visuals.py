"""Render lightweight, lossless map assets from already validated crops.

Does not change/rebuild the scientific dataset. Web images carry exact extents,
worldfiles and source checksums; the routing binaries remain untouched.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data/processed/jezero-hirise-v1"
OUT = ROOT / "public/data/jezero-hirise-v1"
OUT.mkdir(parents=True, exist_ok=True)
raw_manifest = (DATA / "manifest.json").read_bytes()
manifest = json.loads(raw_manifest)
source_hash = {Path(x["path"]).name: x["sha256"] for x in manifest["outputs"]}
with rasterio.open(DATA / "valid_mask.tif") as src:
    # Explicit all-of-2x2: do not min-resample a 0/1 mask with 0 as NoData.
    fine = src.read(1) == 1
    assert src.height % 2 == src.width % 2 == 0
    height, width = src.height // 2, src.width // 2
    joint = fine.reshape(height, 2, width, 2).all(axis=(1, 3))
    extent = list(src.bounds)


def rgb_ramp(values, minimum, maximum, colors):
    stops = np.linspace(minimum, maximum, len(colors))
    table = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in colors])
    return np.stack([np.interp(values, stops, table[:, channel]) for channel in range(3)], axis=-1).astype("uint8")


def save_layer(key, source, title, provenance, method, colors=None, minimum=None, maximum=None):
    with rasterio.open(DATA / source) as src:
        values = (src.read(1).reshape(height, 2, width, 2).max(axis=(1, 3)) if key == "slope"
                  else src.read(1, out_shape=(height, width), resampling=Resampling.average))
    rgb = rgb_ramp(values, minimum, maximum, colors) if colors else np.repeat(values.astype("uint8")[..., None], 3, axis=2)
    rgba = np.dstack((rgb, np.where(joint, 255, 0).astype("uint8")))
    filename = key + ".webp"
    Image.fromarray(rgba).save(OUT / filename, format="WEBP", lossless=True, method=4)
    pixel_x, pixel_y = (extent[2] - extent[0]) / width, (extent[3] - extent[1]) / height
    (OUT / (key + ".wld")).write_text("\n".join(map(str, [pixel_x, 0, 0, -pixel_y, extent[0] + pixel_x / 2, extent[3] - pixel_y / 2])) + "\n", encoding="utf-8")
    return dict(id=key, title=title, file=filename, width=width, height=height, extent=extent,
                displayResolutionM=pixel_x, sourceResolutionM=2, sourceFile=source,
                sourceSha256=source_hash[source], sha256=hashlib.sha256((OUT / filename).read_bytes()).hexdigest(),
                bytes=(OUT / filename).stat().st_size, provenance=provenance, method=method,
                colors=colors, minimum=minimum, maximum=maximum, units="degrees" if key == "slope" else "m" if key == "elevation" else "DN/display",
                alpha="Only fully valid 2x2 source stencils are visible; row 0 north")


layers = [
    save_layer("ortho", "ortho.tif", "Ortoimagen", "Real · imagen orbital procesada", "RED_C monochrome DN, average of 2x2 prepared pixels; lossless WebP"),
    save_layer("hillshade", "hillshade.tif", "Relieve sombreado", "Derivado · The Meowrtian", "Average of prepared synthetic hillshade; azimuth 315 degrees, altitude 45 degrees; not actual sunlight"),
    save_layer("elevation", "dem.tif", "Elevación", "Real · DEM estéreo / visualización derivada", "Average of 2x2 prepared elevations, linear display color ramp; no vertical datum conversion",
               ["#17394c", "#39837e", "#a9bda0", "#d4b88e", "#e8a06d", "#f2e5d5"],
               manifest["statistics"]["elevation_min_m"], manifest["statistics"]["elevation_max_m"]),
    save_layer("slope", "slope_deg.tif", "Pendiente", "Derivado · The Meowrtian", "Maximum of each 2x2 prepared slope block; display saturates at 30 degrees; route calculations use original binaries",
               ["#203c4b", "#467c77", "#b6a45d", "#dc834d", "#a43e3d"], 0, 30),
]
with rasterio.open(DATA / "routing_valid_10m.tif") as src:
    invalid = src.read(1) == 0
    rgba = np.zeros((*invalid.shape, 4), dtype="uint8")
    rgba[invalid] = [190, 105, 190, 115]
    Image.fromarray(rgba).save(OUT / "nodata.webp", format="WEBP", lossless=True, method=4)
    mask = dict(file="nodata.webp", width=src.width, height=src.height, extent=list(src.bounds), resolutionM=10,
                sha256=hashlib.sha256((OUT / "nodata.webp").read_bytes()).hexdigest(), bytes=(OUT / "nodata.webp").stat().st_size,
                sourceFile="routing_valid_10m.tif", sourceSha256=source_hash["routing_valid_10m.tif"],
                meaning="Pink cells are excluded by the prepared routing mask, including partial boundary cells; no slope threshold is added here")
catalog = dict(schema="mars-pathfinder-web-visuals-v1", datasetId=manifest["dataset_id"],
               preparedManifestSha256=hashlib.sha256(raw_manifest).hexdigest(), crsProj=manifest["local_crs_proj"],
               extent=extent, gridTransform=manifest["grid"]["transform_gdal"], routingTransform=manifest["routing_grid"]["transform_gdal"],
               credit="NASA/JPL/University of Arizona · DEM: University of Arizona / USGS-Astrogeology",
               sourceProducts=manifest["input_files"], layers=layers, noData=mask,
               distinction="Official real imagery and stereo DEM; team-derived display colors, slopes and illumination; no simulated terrain")
(OUT / "visuals.json").write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"visuals": len(layers) + 1, "extent": extent, "resolution_m": 4, "total_image_bytes": sum(x["bytes"] for x in layers) + mask["bytes"], "output": str(OUT.relative_to(ROOT))}))
