"""Record the initial real-data mask failure before correcting the warp policy."""
import json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.warp import reproject
from rasterio.enums import Resampling
from rasterio.transform import from_origin

from .geospatial import LOCAL_PROJ

root = Path(__file__).resolve().parents[2]
out = root / "data/processed/jezero-hirise-v1"
diagnostic, arrays = {}, {}
for name in ["ortho_source_crop", "source_coverage_mask", "ortho", "coverage_mask", "valid_mask"]:
    with rasterio.open(out / (name + ".tif")) as src:
        a = src.read(1)
        arrays[name] = a
        diagnostic[name] = {"nodata": src.nodata, "shape": a.shape, "min": int(a.min()), "max": int(a.max()), "zeros": int((a == 0).sum()), "ones": int((a == 1).sum()), "255": int((a == 255).sum())}
a = arrays["ortho"]
bad = (arrays["valid_mask"] > 0) & ((a < 2) | (a > 254))
rows, cols = np.where(bad)
diagnostic["bad_samples"] = list(zip(rows[:10].tolist(), cols[:10].tolist(), a[bad][:10].tolist()))
diagnostic["min_resampling_array_fixture"] = []
source = np.ones((4, 4), dtype="uint8"); source[1, 1] = 0
for nodata in [None, 255]:
    dest = np.zeros((2, 2), dtype="uint8")
    reproject(source, dest, src_transform=from_origin(0, 4, 1, 1), dst_transform=from_origin(0, 4, 2, 2), src_crs=LOCAL_PROJ, dst_crs=LOCAL_PROJ, src_nodata=nodata, dst_nodata=0, resampling=Resampling.min)
    diagnostic["min_resampling_array_fixture"].append({"source_nodata": nodata, "result": dest.tolist()})
(root / "docs/validation/mask-diagnostic.json").write_text(json.dumps(diagnostic, indent=2) + "\n", encoding="utf-8")
print(json.dumps(diagnostic))
