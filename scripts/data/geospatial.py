"""Metric terrain operations; pure functions also used with analytical test fixtures."""
from __future__ import annotations

import math
import numpy as np
from affine import Affine
from scipy.ndimage import binary_erosion

NODATA = -9999.0
LOCAL_PROJ = "+proj=eqc +lat_ts=18.45 +lat_0=0 +lon_0=77.435 +R=3396190 +units=m +no_defs +type=crs"


def aligned_grid(bounds, resolution):
    """Outward-snapped pixel-area grid, north up; bounds are in projected metres."""
    if resolution <= 0 or not all(math.isfinite(x) for x in bounds):
        raise ValueError("Finite bounds and positive resolution required")
    left, bottom, right, top = bounds
    if left >= right or bottom >= top:
        raise ValueError("Empty or reversed extent")
    left, bottom = math.floor(left / resolution) * resolution, math.floor(bottom / resolution) * resolution
    right, top = math.ceil(right / resolution) * resolution, math.ceil(top / resolution) * resolution
    return Affine(resolution, 0, left, 0, -resolution, top), int(round((right - left) / resolution)), int(round((top - bottom) / resolution))


def terrain_derivatives(elevation, valid, resolution, azimuth_deg=315.0, altitude_deg=45.0):
    """Central differences on a local metre grid. Require a fully valid 3x3 stencil.

    Array rows grow southward. Slope is degrees; display hillshade is synthetic
    illumination, with 0 reserved for NoData (not a prediction of Mars lighting).
    """
    if elevation.shape != valid.shape or min(elevation.shape) < 3 or resolution <= 0:
        raise ValueError("Matching arrays >=3x3 and positive metre resolution required")
    valid = valid & np.isfinite(elevation) & (elevation != NODATA)
    usable = binary_erosion(valid, structure=np.ones((3, 3), dtype=bool), border_value=0)
    # Float64 arithmetic prevents avoidable cancellation in analytical gradients;
    # source DEM precision is still Float32 and is not improved by this cast.
    z = np.where(valid, elevation, 0).astype("float64")
    dz_south, dz_east = np.gradient(z, resolution, resolution)
    slope = np.full(z.shape, NODATA, dtype="float32")
    slope[usable] = np.degrees(np.arctan(np.hypot(dz_east[usable], dz_south[usable])))
    azimuth, altitude = np.radians([azimuth_deg, altitude_deg])
    sun_east, sun_north, sun_up = np.sin(azimuth) * np.cos(altitude), np.cos(azimuth) * np.cos(altitude), np.sin(altitude)
    illumination = (-dz_east * sun_east + dz_south * sun_north + sun_up) / np.sqrt(1 + dz_east**2 + dz_south**2)
    hillshade = np.zeros(z.shape, dtype="uint8")
    hillshade[usable] = 1 + np.rint(254 * np.clip(illumination[usable], 0, 1)).astype("uint8")
    return slope, hillshade, usable
