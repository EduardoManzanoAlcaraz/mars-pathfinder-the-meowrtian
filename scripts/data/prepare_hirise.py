"""Prepare a small real HiRISE dataset. No UI or route-planning implementation.

Run from repository root: python -m scripts.data.prepare_hirise
Originals are read by windows. Warps use bounded GDAL memory; terrain operations
use tiles with halos. Only small preview/analysis arrays are read at once.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
from contextlib import ExitStack
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyproj
import rasterio
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.warp import reproject
from rasterio.windows import Window, from_bounds, transform as window_transform
from scipy import ndimage

from .geospatial import LOCAL_PROJ, NODATA, aligned_grid, terrain_derivatives
from .inspect_hirise import DEM, LABEL, ROOT, REPORT, valid_dem, valid_ortho, write_json

os.environ.setdefault("MPLCONFIGDIR", str(ROOT / ".cache/matplotlib"))


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def windows(width, height, size=512):
    for row in range(0, height, size):
        for col in range(0, width, size):
            yield Window(col, row, min(size, width - col), min(size, height - row))


def expanded(window, width, height, halo=1):
    left, top = max(0, int(window.col_off) - halo), max(0, int(window.row_off) - halo)
    right, bottom = min(width, int(window.col_off + window.width) + halo), min(height, int(window.row_off + window.height) + halo)
    return Window(left, top, right - left, bottom - top), (slice(int(window.row_off) - top, int(window.row_off + window.height) - top), slice(int(window.col_off) - left, int(window.col_off + window.width) - left))


def profile(width, height, transform, crs, dtype, nodata):
    return dict(driver="GTiff", width=width, height=height, count=1, transform=transform,
                crs=crs, dtype=dtype, nodata=nodata, tiled=True, blockxsize=512,
                blockysize=512, compress="deflate", predictor=3 if dtype == "float32" else 2,
                zlevel=6, BIGTIFF="IF_SAFER")


def create_native_crops(dem, ortho, out, bounds, cfg):
    w = from_bounds(*bounds, dem.transform)
    margin = cfg["source_margin_pixels"]
    left, top = max(0, math.floor(w.col_off) - margin), max(0, math.floor(w.row_off) - margin)
    right, bottom = min(dem.width, math.ceil(w.col_off + w.width) + margin), min(dem.height, math.ceil(w.row_off + w.height) + margin)
    full = Window(left, top, right - left, bottom - top)
    tf = window_transform(full, dem.transform)
    names = {"dem": out / "dem_source_crop.tif", "ortho": out / "ortho_source_crop.tif", "mask": out / "source_coverage_mask.tif"}
    counts = dict(dem_valid=0, ortho_valid=0, joint_valid=0, total=int(full.width * full.height))
    with ExitStack() as stack:
        dz = stack.enter_context(rasterio.open(names["dem"], "w", **profile(int(full.width), int(full.height), tf, dem.crs, "float32", NODATA)))
        di = stack.enter_context(rasterio.open(names["ortho"], "w", **profile(int(full.width), int(full.height), tf, ortho.crs, "uint8", 0)))
        # Use positive codes: 1=invalid, 2=valid, 0=outside/NoData. In this stack
        # min resampling of a 0/1 mask discarded zero (see regression evidence).
        dm = stack.enter_context(rasterio.open(names["mask"], "w", **profile(int(full.width), int(full.height), tf, dem.crs, "uint8", 0)))
        for win in windows(int(full.width), int(full.height), cfg["block_size"]):
            halo, centre = expanded(win, int(full.width), int(full.height))
            source = Window(left + halo.col_off, top + halo.row_off, halo.width, halo.height)
            z, image = dem.read(1, window=source), ortho.read(1, window=source)
            vz = valid_dem(z, dem.read_masks(1, window=source))
            vi = valid_ortho(image, ortho.read_masks(1, window=source))
            joint = vz & vi
            conservative = ndimage.binary_erosion(joint, structure=np.ones((3, 3), bool), border_value=0)
            dz.write(np.where(vz[centre], z[centre], NODATA).astype("float32"), 1, window=win)
            di.write(np.where(vi[centre], image[centre], 0).astype("uint8"), 1, window=win)
            dm.write(1 + conservative[centre].astype("uint8"), 1, window=win)
            counts["dem_valid"] += int(vz[centre].sum())
            counts["ortho_valid"] += int(vi[centre].sum())
            counts["joint_valid"] += int(joint[centre].sum())
        dz.set_band_unit(1, "m")
        dz.update_tags(provenance="official-stereo-DEM / team-window-crop", vertical_reference="Mars equipotential surface, Mars 2000 datum, per source PDS label")
        di.update_tags(provenance="official-RED-ortho / team-window-crop", georeferencing="Official PDS LBL; conflicting embedded JP2 CRS not used")
        dm.update_tags(codes="0=outside/NoData;1=invalid;2=valid", method="Eroded 3x3 joint source mask, positive codes for conservative min warp")
    return names, {"source_window_col_row_width_height": list(full.flatten()), "counts_with_margin": counts}


def warp_products(native, out, crs, transform, width, height):
    result = {}
    for name, dtype, nodata, method in [("dem", "float32", NODATA, Resampling.bilinear), ("ortho", "uint8", 0, Resampling.bilinear), ("mask", "uint8", 0, Resampling.min)]:
        path = out / ("coverage_codes.tif" if name == "mask" else name + ".tif")
        with rasterio.open(native[name]) as src, rasterio.open(path, "w", **profile(width, height, transform, crs, dtype, nodata)) as dst:
            reproject(source=rasterio.band(src, 1), destination=rasterio.band(dst, 1),
                      src_nodata=src.nodata, dst_nodata=nodata, resampling=method,
                      num_threads=1, warp_mem_limit=64)
            dst.update_tags(provenance="The Meowrtian derivative from real HiRISE products", resampling=method.name)
            if name == "dem":
                dst.set_band_unit(1, "m")
                dst.update_tags(vertical_reference="Unchanged PDS Mars equipotential elevation; no vertical datum conversion")
        result[name] = path
    codes = result["mask"]
    result["mask_codes"] = codes
    result["mask"] = out / "coverage_mask.tif"
    with rasterio.open(codes) as src, rasterio.open(result["mask"], "w", **profile(width, height, transform, crs, "uint8", 0)) as dst:
        for win in windows(width, height):
            dst.write((src.read(1, window=win) == 2).astype("uint8"), 1, window=win)
        dst.update_tags(codes="0=invalid;1=valid", method="Only code 2 survives conservative source mask min-warp")
    return result


def derive(products, out, cfg):
    result = {"slope": out / "slope_deg.tif", "hillshade": out / "hillshade.tif", "valid": out / "valid_mask.tif"}
    with ExitStack() as stack:
        dem = stack.enter_context(rasterio.open(products["dem"]))
        mask = stack.enter_context(rasterio.open(products["mask"]))
        ortho = stack.enter_context(rasterio.open(products["ortho"]))
        outputs = {key: stack.enter_context(rasterio.open(path, "w", **profile(dem.width, dem.height, dem.transform, dem.crs, "float32" if key == "slope" else "uint8", NODATA if key == "slope" else 0))) for key, path in result.items()}
        for win in windows(dem.width, dem.height, cfg["block_size"]):
            halo, centre = expanded(win, dem.width, dem.height)
            z = dem.read(1, window=halo)
            image = ortho.read(1, window=halo)
            valid = (mask.read(1, window=halo) > 0) & (dem.read_masks(1, window=halo) > 0) & valid_ortho(image, ortho.read_masks(1, window=halo))
            slope, shade, usable = terrain_derivatives(z, valid, cfg["resolution_m"], cfg["hillshade_azimuth_deg"], cfg["hillshade_altitude_deg"])
            outputs["slope"].write(slope[centre], 1, window=win)
            outputs["hillshade"].write(shade[centre], 1, window=win)
            outputs["valid"].write(usable[centre].astype("uint8"), 1, window=win)
        outputs["slope"].set_band_unit(1, "degree")
        outputs["slope"].update_tags(method="3x3-valid stencil; central differences in metres; atan(hypot(dz_dx,dz_dy))", analysis_scale_m=str(cfg["resolution_m"]))
        outputs["hillshade"].update_tags(method="Synthetic display illumination; not actual solar conditions", azimuth_deg=str(cfg["hillshade_azimuth_deg"]), altitude_deg=str(cfg["hillshade_altitude_deg"]))
    return result


def alignment_checks(dem, ortho, crs, transform, width, height):
    source_crs, target_crs = pyproj.CRS(dem.crs), pyproj.CRS(crs)
    to_source = pyproj.Transformer.from_crs(target_crs, source_crs, always_xy=True)
    to_local = pyproj.Transformer.from_crs(source_crs, target_crs, always_xy=True)
    to_geo = pyproj.Transformer.from_crs(target_crs, target_crs.geodetic_crs, always_xy=True)
    reports = []
    with WarpedVRT(dem, crs=crs, transform=transform, width=width, height=height, resampling=Resampling.nearest, nodata=NODATA, warp_mem_limit=64) as vz, WarpedVRT(ortho, crs=crs, transform=transform, width=width, height=height, resampling=Resampling.nearest, src_nodata=0, nodata=0, warp_mem_limit=64) as vi:
        for fx, fy in [(0.15, 0.15), (0.85, 0.15), (0.5, 0.5), (0.15, 0.85), (0.85, 0.85)]:
            row, col = int(fy * height), int(fx * width)
            x, y = rasterio.transform.xy(transform, row, col)
            sx, sy = to_source.transform(x, y)
            sr, sc = dem.index(sx, sy)
            original_window = Window(sc, sr, 1, 1)
            pixel = Window(col, row, 1, 1)
            z, image = float(dem.read(1, window=original_window)[0, 0]), int(ortho.read(1, window=original_window)[0, 0])
            local_z, local_image = float(vz.read(1, window=pixel)[0, 0]), int(vi.read(1, window=pixel)[0, 0])
            xx, yy = to_local.transform(sx, sy)
            reports.append({"row": row, "col": col, "x_m": x, "y_m": y, "lon_lat_mars": list(to_geo.transform(x, y)), "source_row": sr, "source_col": sc, "elevation_m": z, "image_dn": image,
                            "roundtrip_error_m": math.hypot(xx - x, yy - y), "nearest_gdal_vs_independent_pyproj_dem_difference_m": local_z - z, "nearest_gdal_vs_independent_pyproj_image_difference_dn": local_image - image,
                            "source_valid": bool(z > -1e20 and 1 < image < 255)})
    geod = pyproj.Geod(a=3396190, b=3396190)
    metrics = []
    for a, b in [(reports[0], reports[1]), (reports[0], reports[3]), (reports[0], reports[4])]:
        _, _, distance = geod.inv(*a["lon_lat_mars"], *b["lon_lat_mars"])
        local_distance = math.hypot(b["x_m"] - a["x_m"], b["y_m"] - a["y_m"])
        metrics.append({"local_distance_m": local_distance, "mars_sphere_geodesic_m": distance, "relative_difference_percent": 100 * abs(local_distance - distance) / distance})
    return {"method": "Five target pixel centres transformed independently with pyproj; compare actual source pixels with GDAL nearest-neighbour warp. This checks data mapping, not external absolute accuracy.", "samples": reports, "distance_checks": metrics}


def summary_stats(products, derived, cfg):
    with rasterio.open(products["dem"]) as src:
        z, dem_valid = src.read(1), src.read_masks(1) > 0
        bounds = list(src.bounds)
    with rasterio.open(products["ortho"]) as src:
        image = src.read(1)
        ortho_valid = (src.read_masks(1) > 0) & (image > 1) & (image < 255)
    with rasterio.open(products["mask"]) as src:
        coverage = src.read(1) > 0
    with rasterio.open(derived["valid"]) as src:
        valid = src.read(1) > 0
    with rasterio.open(derived["slope"]) as src:
        slope = src.read(1)
    # Diagnostics flag suspicious local jumps without claiming they are proven errors.
    median = ndimage.median_filter(z, size=3, mode="nearest")
    residual = np.abs(z - median)
    diagnostic_valid = ndimage.binary_erosion(valid, structure=np.ones((3, 3), bool))
    max_slope_row, max_slope_col = np.unravel_index(np.argmax(np.where(valid, slope, -1)), z.shape)
    traversable = valid & (slope <= cfg["connectivity_demo_slope_limit_deg"])
    components, count = ndimage.label(traversable)  # Conservative 4-neighbour connectivity, no route calculation.
    sizes = np.bincount(components.ravel()); sizes[0] = 0
    largest = int(sizes.max(initial=0))
    statistics = {
        "total_pixels": int(z.size), "projected_bounds_m": bounds,
        "dem_valid_percent": float(100 * dem_valid.mean()), "ortho_valid_percent": float(100 * ortho_valid.mean()),
        "conservative_joint_coverage_percent": float(100 * coverage.mean()), "derivative_valid_percent": float(100 * valid.mean()),
        "elevation_min_m": float(z[valid].min()), "elevation_max_m": float(z[valid].max()),
        "slope_deg_percentiles_0_50_90_95_99_100": np.percentile(slope[valid], [0, 50, 90, 95, 99, 100]).tolist(),
        "slope_over_45_deg_pixels": int((valid & (slope > 45)).sum()),
        "possible_artifact_diagnostics": {
            "local_median3x3_residual_max_m": float(residual[diagnostic_valid].max()),
            "local_median3x3_residual_over_5m_pixels": int((diagnostic_valid & (residual > 5)).sum()),
            "maximum_slope_row_col": [int(max_slope_row), int(max_slope_col)],
            "interpretation": "High slope and local residuals can be real cliffs or stereo artefacts. No confidence raster/ground truth was supplied; these diagnostics do not classify them or remove them automatically.",
        },
        "connectivity_assumption_slope_limit_deg": cfg["connectivity_demo_slope_limit_deg"],
        "traversable_percent_of_total": float(100 * traversable.mean()), "connected_components_4_neighbours": count,
        "largest_component_pixels": largest, "largest_component_area_m2": largest * cfg["resolution_m"] ** 2,
        "largest_component_percent_of_traversable": 100 * largest / max(1, int(traversable.sum())),
        "connectivity_is_not_an_Astar_route_or_EVA_safety_validation": True,
    }
    return statistics


def prepare_routing_grid(products, derived, out, cfg):
    """Data aggregation only: 5x5 fine pixels -> one 10 m cell, no path algorithm."""
    factor = 5
    names = {"dem": out / "routing_dem_10m.tif", "slope": out / "routing_slope_max_10m.tif", "valid": out / "routing_valid_10m.tif"}
    with ExitStack() as stack:
        dem = stack.enter_context(rasterio.open(products["dem"]))
        slope = stack.enter_context(rasterio.open(derived["slope"]))
        mask = stack.enter_context(rasterio.open(derived["valid"]))
        width, height = math.ceil(dem.width / factor), math.ceil(dem.height / factor)
        tf = dem.transform * rasterio.Affine.scale(factor)
        output = {k: stack.enter_context(rasterio.open(p, "w", **profile(width, height, tf, dem.crs, "uint8" if k == "valid" else "float32", 0 if k == "valid" else NODATA))) for k, p in names.items()}
        for win in windows(width, height, 128):
            fine = Window(win.col_off * factor, win.row_off * factor, win.width * factor, win.height * factor)
            z = dem.read(1, window=fine, boundless=True, fill_value=NODATA)
            s = slope.read(1, window=fine, boundless=True, fill_value=NODATA)
            v = mask.read(1, window=fine, boundless=True, fill_value=0) > 0
            shape = (int(win.height), factor, int(win.width), factor)
            coarse_valid = v.reshape(shape).all(axis=(1, 3))
            # A cell touching any unknown fine pixel (including partial outer cells)
            # is blocked. No averaging of the slope: preserve the maximum.
            mean_z = z.reshape(shape).mean(axis=(1, 3))
            max_slope = s.reshape(shape).max(axis=(1, 3))
            output["dem"].write(np.where(coarse_valid, mean_z, NODATA).astype("float32"), 1, window=win)
            output["slope"].write(np.where(coarse_valid, max_slope, NODATA).astype("float32"), 1, window=win)
            output["valid"].write(coarse_valid.astype("uint8"), 1, window=win)
        output["dem"].set_band_unit(1, "m"); output["slope"].set_band_unit(1, "degree")
    for key, suffix, dtype in [("dem", "elevation.f32", "<f4"), ("slope", "slope_max.f32", "<f4"), ("valid", "valid.u8", "u1")]:
        path = out / ("routing_" + suffix)
        with rasterio.open(names[key]) as src:
            src.read(1).astype(dtype).tofile(path)
        names[key + "_binary"] = path
    with rasterio.open(names["valid"]) as src:
        valid = src.read(1) > 0
    with rasterio.open(names["slope"]) as src:
        s = src.read(1)
    possible = valid & (s <= cfg["connectivity_demo_slope_limit_deg"])
    components, count = ndimage.label(possible)
    counts = np.bincount(components.ravel()); counts[0] = 0
    result = {
        "width": width, "height": height, "resolution_m": 10, "transform_gdal": list(tf.to_gdal()),
        "crs": "Same local Mars CRS as the 2 m layers", "layout": "row-major, row 0 north; centres at col+0.5,row+0.5", "binary_endianness": "little", "binary_float_type": "Float32", "nodata_float": NODATA, "mask_codes": "0=blocked/unknown, 1=valid (slope policy still to be applied)",
        "aggregation": "5x5: all valid; mean elevation; maximum slope. Partial edge cells blocked.",
        "total_cells": width * height, "valid_cells": int(valid.sum()), "valid_percent": float(100 * valid.mean()),
        "cells_at_or_below_demo_15deg": int(possible.sum()), "largest_4_connected_component_cells_at_demo_15deg": int(counts.max(initial=0)), "connected_components_at_demo_15deg": count,
        "paths": {k: p.name for k, p in names.items()}, "route_computed": False,
    }
    return names, result


def make_previews(products, derived, out):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle
    from mpl_toolkits.axes_grid1.anchored_artists import AnchoredSizeBar
    with ExitStack() as stack:
        srcs = {**{k: stack.enter_context(rasterio.open(v)) for k, v in products.items()}, **{k: stack.enter_context(rasterio.open(v)) for k, v in derived.items()}}
        ref = srcs["dem"]
        shape = (max(1, ref.height // 2), max(1, ref.width // 2))
        data = {k: s.read(1, out_shape=shape, resampling=Resampling.nearest) for k, s in srcs.items()}
        invalid = data["valid"] == 0
        z, slope = np.ma.masked_where(invalid, data["dem"]), np.ma.masked_where(invalid, data["slope"])
        image = np.ma.masked_where(invalid, data["ortho"])
        extent = [ref.bounds.left / 1000, ref.bounds.right / 1000, ref.bounds.bottom / 1000, ref.bounds.top / 1000]
        xx = np.linspace(extent[0], extent[1], shape[1], endpoint=False) + (extent[1] - extent[0]) / (2 * shape[1])
        yy = np.linspace(extent[3], extent[2], shape[0], endpoint=False) - (extent[3] - extent[2]) / (2 * shape[0])
        fig, axes = plt.subplots(2, 2, figsize=(12, 11), constrained_layout=True)
        axes[0, 0].imshow(image, extent=extent, cmap="gray", vmin=35, vmax=180)
        axes[0, 0].set_title("Orto HiRISE RED_C · datos reales")
        axes[0, 1].imshow(np.ma.masked_where(invalid, data["hillshade"]), extent=extent, cmap="gray", vmin=1, vmax=255)
        axes[0, 1].set_title("Relieve sombreado · luz sintética 315° / 45°")
        im = axes[1, 0].imshow(z, extent=extent, cmap="terrain")
        fig.colorbar(im, ax=axes[1, 0], shrink=0.8, label="Elevación sobre equipotencial (m)")
        axes[1, 0].set_title("DEM estéreo reproyectado · resolución 2 m")
        im = axes[1, 1].imshow(slope, extent=extent, cmap="magma", vmin=0, vmax=30)
        fig.colorbar(im, ax=axes[1, 1], shrink=0.8, label="Pendiente (°), saturación visual a 30°")
        axes[1, 1].set_title("Pendiente derivada · diferencias centrales")
        for ax in axes.flat:
            ax.set_facecolor("#e5a9ca")
            ax.set_xlabel("Este local (km)"); ax.set_ylabel("Norte local (km)")
            ax.add_artist(AnchoredSizeBar(ax.transData, 0.5, "500 m", loc="lower left", pad=0.3, color="black", frameon=True, size_vertical=0.008))
        fig.suptitle("Mars Pathfinder · Jezero · NASA/JPL/University of Arizona\nCRS local marciano, R=3396190 m · rosa = sin datos válidos conjuntos", fontsize=13)
        fig.savefig(out / "preview.png", dpi=150)
        plt.close(fig)
        fig, ax = plt.subplots(figsize=(10, 9), constrained_layout=True)
        ax.imshow(image, extent=extent, cmap="gray", vmin=35, vmax=180)
        levels = np.arange(math.floor(float(z.min()) / 5) * 5, float(z.max()) + 5, 5)
        lines = ax.contour(xx, yy, z, levels=levels, colors="#29e7db", linewidths=0.45, alpha=0.8)
        ax.clabel(lines, inline=True, fontsize=6, fmt="%d")
        ax.set_title("Comprobación visual: orto real + curvas DEM cada 5 m\nContornos y estructuras del terreno; no es validación geodésica externa")
        ax.set_xlabel("Este local (km)"); ax.set_ylabel("Norte local (km)"); ax.set_facecolor("#e5a9ca")
        ax.add_artist(AnchoredSizeBar(ax.transData, 0.5, "500 m", loc="lower left", color="black", frameon=True, size_vertical=0.008))
        fig.savefig(out / "alignment_overlay.png", dpi=160)
        plt.close(fig)
        # Two independent modalities in five distributed windows; preserve common extent.
        centres = [(0.18, 0.18), (0.75, 0.20), (0.50, 0.50), (0.20, 0.78), (0.78, 0.78)]
        fig, axes = plt.subplots(2, 5, figsize=(18, 7), constrained_layout=True)
        patches = []
        for k, (fx, fy) in enumerate(centres):
            col, row = int(fx * ref.width), int(fy * ref.height)
            win = Window(max(0, col - 128), max(0, row - 128), 256, 256)
            a, b = srcs["ortho"].read(1, window=win), srcs["hillshade"].read(1, window=win)
            axes[0, k].imshow(a, cmap="gray", vmin=35, vmax=180, extent=[0, 512, 512, 0])
            axes[1, k].imshow(b, cmap="gray", vmin=1, vmax=255, extent=[0, 512, 512, 0])
            for ax in axes[:, k]:
                ax.axvline(256, color="#19ddd0", linewidth=0.5); ax.axhline(256, color="#19ddd0", linewidth=0.5)
                ax.set_xticks([0, 256, 512]); ax.set_yticks([0, 256, 512]); ax.set_xlabel("Distancia en ventana (m)")
            axes[0, k].set_title(f"Ventana {k + 1} · orto")
            axes[1, k].set_title(f"Ventana {k + 1} · relieve")
            patches.append({"id": k + 1, "window_col_row_width_height": list(win.flatten()), "centre_local_m": list(rasterio.transform.xy(ref.transform, row, col))})
        fig.suptitle("Inspección multimodal · mismas ventanas de 512 × 512 m · sombreado sintético")
        fig.savefig(out / "alignment_windows.png", dpi=140)
        plt.close(fig)
        return patches


def main():
    cfg = json.loads((ROOT / "scripts/data/jezero-hirise.json").read_text(encoding="utf-8"))
    out = ROOT / "data/processed" / cfg["dataset_id"]
    out.mkdir(parents=True, exist_ok=True)
    target = pyproj.CRS(LOCAL_PROJ)
    report = {"dataset_id": cfg["dataset_id"], "configuration": cfg, "local_crs_wkt": target.to_wkt(), "local_crs_proj": LOCAL_PROJ,
              "vertical_reference": "Mars equipotential surface, Mars 2000 datum, per official PDS label; unchanged heights",
              "provenance": "Real official HiRISE inputs; all crops, warps, slope, mask and display illumination derived by The Meowrtian"}
    downloads = json.loads((REPORT / "downloads.json").read_text(encoding="utf-8"))
    report["input_files"] = downloads["files"]
    for item in report["input_files"]:
        path = ROOT / item["path"]
        if path.stat().st_size != item["bytes"] or sha256(path) != item["sha256"]:
            raise RuntimeError(f"Input integrity differs from download manifest: {item['path']}")
    with rasterio.Env(GDAL_CACHEMAX=128 * 1024 * 1024, GDAL_NUM_THREADS="1", OPJ_NUM_THREADS="1", GDAL_PAM_ENABLED="NO"):
        with rasterio.open(DEM) as dem, rasterio.open(LABEL) as ortho:
            if dem.transform != ortho.transform or not pyproj.CRS(dem.crs).equals(pyproj.CRS(ortho.crs), ignore_axis_order=True):
                raise RuntimeError("PDS-labelled grids are not coincident")
            west, south, east, north = cfg["aoi_lon_lat"]
            source_projection = pyproj.Transformer.from_crs(pyproj.CRS(dem.crs).geodetic_crs, dem.crs, always_xy=True)
            local_projection = pyproj.Transformer.from_crs(target.geodetic_crs, target, always_xy=True)
            source_bounds = (*source_projection.transform(west, south), *source_projection.transform(east, north))
            local_bounds = (*local_projection.transform(west, south), *local_projection.transform(east, north))
            transform, width, height = aligned_grid(local_bounds, cfg["resolution_m"])
            report["grid"] = {"width": width, "height": height, "resolution_m": cfg["resolution_m"], "transform_gdal": list(transform.to_gdal()), "axis_order": "x east / y north; row 0 at north; pixel area; centres at col+0.5,row+0.5"}
            native, report["native_crop"] = create_native_crops(dem, ortho, out, source_bounds, cfg)
            products = warp_products(native, out, rasterio.crs.CRS.from_wkt(target.to_wkt()), transform, width, height)
            derived = derive(products, out, cfg)
            report["alignment_numeric"] = alignment_checks(dem, ortho, rasterio.crs.CRS.from_wkt(target.to_wkt()), transform, width, height)
        report["statistics"] = summary_stats(products, derived, cfg)
        routing, report["routing_grid"] = prepare_routing_grid(products, derived, out, cfg)
        report["visual_inspection_windows"] = make_previews(products, derived, out)
    all_paths = list(native.values()) + list(products.values()) + list(derived.values()) + list(routing.values()) + [out / f for f in ["preview.png", "alignment_overlay.png", "alignment_windows.png"]]
    report["outputs"] = [{"path": str(p.relative_to(ROOT)).replace("\\", "/"), "bytes": p.stat().st_size, "sha256": sha256(p)} for p in all_paths]
    write_json(out / "manifest.json", report)
    write_json(REPORT / "crop-report.json", report)
    print(json.dumps({"grid": report["grid"], "statistics": report["statistics"], "routing_grid": report["routing_grid"], "output_directory": str(out.relative_to(ROOT))}))


if __name__ == "__main__":
    main()
