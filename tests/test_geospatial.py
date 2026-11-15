"""Analytical fixtures are artificial test data, never Mars scientific measurements."""
import numpy as np
import pytest

from scripts.data.geospatial import NODATA, aligned_grid, terrain_derivatives


def test_flat_surface_has_zero_slope_and_expected_synthetic_light():
    slope, shade, valid = terrain_derivatives(np.full((11, 13), -2500, dtype="float32"), np.ones((11, 13), bool), 2)
    assert valid.sum() == 9 * 11
    np.testing.assert_allclose(slope[valid], 0, atol=1e-6)
    assert np.unique(shade[valid]).tolist() == [1 + round(254 / np.sqrt(2))]
    assert (slope[~valid] == NODATA).all()
    assert (shade[~valid] == 0).all()


@pytest.mark.parametrize("resolution", [1.0, 2.0, 10.0])
def test_metric_plane_slope_is_independent_of_pixel_size(resolution):
    rows, cols = np.indices((31, 29))
    z = 0.1 * cols * resolution + 0.2 * rows * resolution
    slope, _, valid = terrain_derivatives(z, np.ones(z.shape, bool), resolution)
    np.testing.assert_allclose(slope[valid], np.degrees(np.arctan(np.hypot(0.1, 0.2))), atol=1e-5)


def test_nodata_hole_is_never_interpreted_as_a_cliff_or_flat_ground():
    z = np.zeros((11, 11), dtype="float32")
    z[5, 5] = NODATA
    slope, shade, valid = terrain_derivatives(z, np.ones(z.shape, bool), 2)
    assert not valid[4:7, 4:7].any()
    assert (slope[4:7, 4:7] == NODATA).all()
    assert not shade[4:7, 4:7].any()
    assert valid[2, 2] and slope[2, 2] == 0


def test_grid_bounds_snap_outward_and_pixel_centres_roundtrip():
    tf, width, height = aligned_grid((-1.1, 10.1, 6.1, 18.1), 2)
    assert (width, height) == (5, 5)
    assert (tf.c, tf.f) == (-2, 20)
    assert tf @ (0.5, 0.5) == (-1, 19)
    assert ~tf @ (-1, 19) == (0.5, 0.5)
    assert tf @ (width, height) == (8, 10)


def test_invalid_resolution_is_rejected():
    with pytest.raises(ValueError):
        terrain_derivatives(np.zeros((5, 5)), np.ones((5, 5), bool), 0)
    with pytest.raises(ValueError):
        aligned_grid((0, 0, 10, 10), -1)


def test_conservative_positive_mask_codes_preserve_a_hole_when_downsampled():
    from rasterio.enums import Resampling
    from rasterio.transform import from_origin
    from rasterio.warp import reproject
    from scripts.data.geospatial import LOCAL_PROJ
    codes = np.full((4, 4), 2, dtype="uint8")
    codes[1, 1] = 1  # An invalid source pixel must invalidate its entire output cell.
    output = np.zeros((2, 2), dtype="uint8")
    reproject(codes, output, src_transform=from_origin(0, 4, 1, 1), dst_transform=from_origin(0, 4, 2, 2), src_crs=LOCAL_PROJ, dst_crs=LOCAL_PROJ, src_nodata=0, dst_nodata=0, resampling=Resampling.min)
    np.testing.assert_array_equal(output == 2, [[False, True], [True, True]])
