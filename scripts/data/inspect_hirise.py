"""Inspect real source files with Rasterio/GDAL; scan pixels in bounded row windows."""
from __future__ import annotations

import importlib.metadata
import importlib.util
import json
import platform
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyproj
import rasterio
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/raw/hirise-pds"
REPORT = ROOT / "docs/validation"
DEM = RAW / "DTEEC_045994_1985_046060_1985_U01.IMG"
ORTHO = RAW / "ESP_046060_1985_RED_C_01_ORTHO.JP2"
LABEL = ORTHO.with_suffix(".LBL")


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")


def describe(src):
    return {
        "path": str(Path(src.name).relative_to(ROOT)).replace("\\", "/"),
        "driver": src.driver, "width": src.width, "height": src.height,
        "count": src.count, "dtype": src.dtypes[0], "nodata": src.nodata,
        "units_from_driver": list(src.units), "scale": list(src.scales), "offset": list(src.offsets),
        "resolution_m_projected": list(src.res), "transform_gdal": list(src.transform.to_gdal()),
        "bounds_m_projected": list(src.bounds), "crs_wkt": src.crs.to_wkt(),
        "crs_proj": src.crs.to_proj4(), "block_shapes": list(src.block_shapes),
        "tags": src.tags(),
    }


def valid_dem(a, mask):
    # Reject both driver NoData and extreme PDS floating-point special constants.
    return (mask > 0) & np.isfinite(a) & (a > -1e20) & (a < 1e20)


def valid_ortho(a, mask):
    # PDS label: 0 null; 1 low saturation; 255 high saturation. RED_C is 8 bit.
    return (mask > 0) & (a > 1) & (a < 255)


def main():
    with rasterio.Env(GDAL_CACHEMAX=128 * 1024 * 1024, GDAL_NUM_THREADS="1", OPJ_NUM_THREADS="1") as env:
        versions = {x: importlib.metadata.version(x) for x in ["rasterio", "pyproj", "numpy", "pillow", "scipy", "pytest"]}
        environment = {
            "checked_at_utc": datetime.now(timezone.utc).isoformat(),
            "python": sys.version, "executable": str(Path(sys.executable).relative_to(ROOT)),
            "platform": platform.platform(), "machine": platform.machine(),
            "versions": versions, "gdal": rasterio.__gdal_version__,
            "proj_rasterio": rasterio.__proj_version__, "proj_pyproj": pyproj.proj_version_str,
            "drivers": {k: v for k, v in env.drivers().items() if k in ["PDS", "PDS4", "JP2OpenJPEG", "GTiff", "PNG"]},
            "osgeo_python_bindings": importlib.util.find_spec("osgeo") is not None,
            "standalone_gdalinfo": shutil.which("gdalinfo"),
            "free_bytes": shutil.disk_usage(ROOT).free,
            "processing": "Rasterio Python API linked to GDAL; no separate osgeo bindings required",
        }
        write_json(REPORT / "environment.json", environment)
        for driver in ["PDS", "JP2OpenJPEG", "GTiff", "PNG"]:
            if driver not in env.drivers():
                raise RuntimeError(f"Required GDAL driver absent: {driver}")
        report = {"environment": "environment.json", "sources": {}, "scan_row_count": 256}
        with rasterio.open(DEM) as dem, rasterio.open(LABEL) as ortho, rasterio.open(ORTHO) as jp2:
            report["sources"]["dem"] = describe(dem)
            report["sources"]["ortho_jp2"] = describe(jp2)
            report["sources"]["ortho_lbl"] = describe(ortho)
            windows = [Window(1000, 2000, 32, 32), Window(3000, 6000, 32, 32), Window(5000, 12000, 32, 32), Window(3000, 10000, 32, 32), Window(4000, 4000, 32, 32)]
            report["jp2_vs_lbl"] = {
                "direct_jp2_crs_equivalent_to_dem": pyproj.CRS(dem.crs).equals(pyproj.CRS(jp2.crs), ignore_axis_order=True),
                "direct_jp2_origin_delta_pixels": [(jp2.transform.c - dem.transform.c) / dem.res[0], (jp2.transform.f - dem.transform.f) / dem.res[1]],
                "five_32x32_windows_have_identical_pixels": all(np.array_equal(ortho.read(1, window=w), jp2.read(1, window=w)) for w in windows),
                "selected_georeferencing": "Official PDS LBL opened via GDAL PDS driver; JP2 decoded without using its conflicting embedded CRS",
                "manual_shift_applied": False,
            }
            same_crs = pyproj.CRS(dem.crs).equals(pyproj.CRS(ortho.crs), ignore_axis_order=True)
            report["native_grid_check"] = {
                "equivalent_crs": same_crs,
                "same_shape": dem.shape == ortho.shape,
                "max_affine_coefficient_difference": float(np.max(np.abs(np.array(dem.transform) - np.array(ortho.transform)))),
            }
            write_json(REPORT / "sources.json", report)
            if not same_crs or dem.shape != ortho.shape or not np.allclose(dem.transform, ortho.transform, rtol=0, atol=1e-7):
                raise RuntimeError("Native grids differ; inspect sources.json before processing")
            totals = dict(dem_valid=0, ortho_valid=0, joint_valid=0, dem_nonfinite=0, dem_driver_mask_valid_but_special=0)
            zmin, zmax = float("inf"), float("-inf")
            min_row, min_col, max_row, max_col = dem.height, dem.width, -1, -1
            for row in range(0, dem.height, 256):
                window = Window(0, row, dem.width, min(256, dem.height - row))
                a = dem.read(1, window=window)
                am = dem.read_masks(1, window=window)
                b = ortho.read(1, window=window)
                bm = ortho.read_masks(1, window=window)
                va, vb = valid_dem(a, am), valid_ortho(b, bm)
                joint = va & vb
                totals["dem_valid"] += int(va.sum())
                totals["ortho_valid"] += int(vb.sum())
                totals["joint_valid"] += int(joint.sum())
                totals["dem_nonfinite"] += int((~np.isfinite(a)).sum())
                totals["dem_driver_mask_valid_but_special"] += int(((am > 0) & ~va).sum())
                if va.any():
                    zmin, zmax = min(zmin, float(a[va].min())), max(zmax, float(a[va].max()))
                if joint.any():
                    rows, cols = np.where(joint)
                    min_row, max_row = min(min_row, row + int(rows.min())), max(max_row, row + int(rows.max()))
                    min_col, max_col = min(min_col, int(cols.min())), max(max_col, int(cols.max()))
            total = dem.width * dem.height
            report["full_source_scan"] = {"pixels": total, **totals, "dem_min_m": zmin, "dem_max_m": zmax,
                "dem_valid_percent": 100 * totals["dem_valid"] / total,
                "ortho_valid_percent": 100 * totals["ortho_valid"] / total,
                "joint_valid_percent": 100 * totals["joint_valid"] / total,
                "joint_valid_pixel_envelope": [min_col, min_row, max_col + 1, max_row + 1],
                "joint_valid_bounds_m": list(rasterio.windows.bounds(Window(min_col, min_row, max_col - min_col + 1, max_row - min_row + 1), dem.transform)),
                "envelope_warning": "Bounding rectangle only; holes and outside-footprint pixels remain invalid"}
            write_json(REPORT / "sources.json", report)
        print(json.dumps({"environment": environment, "grid": report["native_grid_check"], "scan": report["full_source_scan"]}, ensure_ascii=True))


if __name__ == "__main__":
    main()
