"""Integration checks against the actually prepared HiRISE files. Missing data fails."""
import json
from pathlib import Path

import numpy as np
import pyproj
import pytest
import rasterio
from rasterio.windows import Window

from scripts.data.geospatial import NODATA, terrain_derivatives

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/processed/jezero-hirise-v1"


@pytest.fixture(scope="module")
def report():
    return json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))


def test_dimensions_resolution_and_martian_radius(report):
    for name in ["dem", "ortho", "coverage_mask", "slope_deg", "hillshade", "valid_mask"]:
        with rasterio.open(OUT / (name + ".tif")) as ds:
            assert ds.width == report["grid"]["width"] and ds.height == report["grid"]["height"]
            assert ds.res == (2.0, 2.0)
            assert list(ds.transform.to_gdal()) == report["grid"]["transform_gdal"]
            assert pyproj.CRS(ds.crs).ellipsoid.semi_major_metre == 3396190
            assert ds.crs.to_epsg() not in (4326, 3857)


def test_outputs_contain_valid_dem_ortho_and_terrain_stencil(report):
    with rasterio.open(OUT / "valid_mask.tif") as ds:
        valid = ds.read(1) == 1
    with rasterio.open(OUT / "dem.tif") as ds:
        z, mask = ds.read(1), ds.read_masks(1)
        assert ds.nodata == NODATA
        assert (mask[valid] > 0).all() and np.isfinite(z[valid]).all()
        assert (z[valid] > -2680).all() and (z[valid] < -2387).all()
    with rasterio.open(OUT / "ortho.tif") as ds:
        image = ds.read(1)
        assert ((image[valid] > 1) & (image[valid] < 255)).all()
    with rasterio.open(OUT / "slope_deg.tif") as ds:
        slope = ds.read(1)
        assert (slope[~valid] == NODATA).all()
        assert ((slope[valid] >= 0) & (slope[valid] < 90)).all()
    assert not valid[0].any() and not valid[-1].any() and not valid[:, 0].any() and not valid[:, -1].any()
    assert report["statistics"]["derivative_valid_percent"] >= 98


def test_five_actual_pixel_mappings_and_coordinate_roundtrips(report):
    samples = report["alignment_numeric"]["samples"]
    assert len(samples) == 5
    for point in samples:
        assert point["source_valid"]
        assert point["roundtrip_error_m"] < 0.01
        assert point["nearest_gdal_vs_independent_pyproj_dem_difference_m"] == 0
        assert point["nearest_gdal_vs_independent_pyproj_image_difference_dn"] == 0
    assert max(p["relative_difference_percent"] for p in report["alignment_numeric"]["distance_checks"]) < 1


def test_official_label_and_embedded_jp2_discrepancy_is_documented():
    sources = json.loads((ROOT / "docs/validation/sources.json").read_text(encoding="utf-8"))
    assert sources["native_grid_check"]["equivalent_crs"]
    assert sources["native_grid_check"]["max_affine_coefficient_difference"] == 0
    assert not sources["jp2_vs_lbl"]["direct_jp2_crs_equivalent_to_dem"]
    assert sources["jp2_vs_lbl"]["five_32x32_windows_have_identical_pixels"]
    assert sources["jp2_vs_lbl"]["manual_shift_applied"] is False


def test_actual_slope_has_no_tile_seam_at_512_pixel_boundary():
    with rasterio.open(OUT / "dem.tif") as dem, rasterio.open(OUT / "coverage_mask.tif") as mask, rasterio.open(OUT / "slope_deg.tif") as slope:
        win = Window(505, 505, 15, 15)
        z, valid = dem.read(1, window=win), mask.read(1, window=win) > 0
        expected, _, usable = terrain_derivatives(z, valid, 2)
        measured = slope.read(1, window=win)
        np.testing.assert_allclose(measured[usable], expected[usable], atol=1e-5)


def test_contiguous_region_is_large_enough_for_future_route_experiments(report):
    assert report["statistics"]["largest_component_area_m2"] >= 1_000_000
    assert report["statistics"]["connectivity_is_not_an_Astar_route_or_EVA_safety_validation"]


def test_all_generated_files_have_recorded_sizes_and_sha256(report):
    from scripts.data.prepare_hirise import sha256
    for output in report["outputs"]:
        path = ROOT / output["path"]
        assert path.stat().st_size == output["bytes"]
        assert sha256(path) == output["sha256"]


def test_routing_grid_preserves_max_slope_and_blocks_partial_cells(report):
    routing = report["routing_grid"]
    assert routing["total_cells"] <= 250_000
    with rasterio.open(OUT / "routing_valid_10m.tif") as mask, rasterio.open(OUT / "routing_slope_max_10m.tif") as slope, rasterio.open(OUT / "slope_deg.tif") as fine, rasterio.open(OUT / "valid_mask.tif") as valid_fine:
        assert mask.shape == (routing["height"], routing["width"])
        assert mask.res == (10, 10)
        assert (mask.read(1)[:, -1] == 0).all()  # Only 3/5 fine columns at the outer edge.
        for row, col in [(20, 20), (100, 120), (200, 200), (300, 300)]:
            window = Window(col * 5, row * 5, 5, 5)
            expected_valid = bool((valid_fine.read(1, window=window) == 1).all())
            assert bool(mask.read(1, window=Window(col, row, 1, 1))[0, 0]) == expected_valid
            measured = slope.read(1, window=Window(col, row, 1, 1))[0, 0]
            assert measured == (fine.read(1, window=window).max() if expected_valid else NODATA)
    for key, bytes_per_cell in [("dem_binary", 4), ("slope_binary", 4), ("valid_binary", 1)]:
        assert (OUT / routing["paths"][key]).stat().st_size == routing["total_cells"] * bytes_per_cell
