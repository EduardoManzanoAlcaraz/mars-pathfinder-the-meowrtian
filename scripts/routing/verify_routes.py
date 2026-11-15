"""Independent real-data audit + SciPy Dijkstra + figure. No geodata reprocessing."""
from __future__ import annotations

import hashlib
import json
import math
import os
import platform
import time
from pathlib import Path

import numpy as np
import pyproj
import rasterio
import scipy
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data/processed/jezero-hirise-v1"
ROUTES = ROOT / "data/routes/jezero-hirise-v1"
REPORTS = ROOT / "docs/routing-validation"
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / ".cache/matplotlib"))
manifest_bytes = (DATA / "manifest.json").read_bytes()
manifest = json.loads(manifest_bytes)
spec = manifest["routing_grid"]
width, height = spec["width"], spec["height"]
assert (width, height) == (394, 356)
assert spec["binary_endianness"] == "little" and spec["binary_float_type"] == "Float32"
tf = spec["transform_gdal"]
paths = [DATA / spec["paths"][key] for key in ["dem_binary", "slope_binary", "valid_binary"]]
before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
z = np.fromfile(paths[0], dtype="<f4").astype("float64")
slope = np.fromfile(paths[1], dtype="<f4").astype("float64")
mask = np.fromfile(paths[2], dtype="uint8")
assert z.size == slope.size == mask.size == width * height
geographic = pyproj.Transformer.from_crs(pyproj.CRS(manifest["local_crs_proj"]), pyproj.CRS(manifest["local_crs_proj"]).geodetic_crs, always_xy=True)


def make_graph(max_slope, reference, weight):
    allowed = (mask == 1) & np.isfinite(z) & np.isfinite(slope) & (z != spec["nodata_float"]) & (slope != spec["nodata_float"]) & (slope >= 0) & (slope < 90) & (slope <= max_slope)
    ids = np.arange(width * height, dtype="int32").reshape(height, width)
    sources, destinations, costs = [], [], []
    for dr in [-1, 0, 1]:
        for dc in [-1, 0, 1]:
            if not dr and not dc:
                continue
            a = ids[max(0, -dr):min(height, height - dr), max(0, -dc):min(width, width - dc)].ravel()
            b = a + dr * width + dc
            distance = math.hypot(dc * tf[1], dr * tf[5])
            angle = np.degrees(np.arctan(np.abs(z[b] - z[a]) / distance))
            effective = np.maximum(angle, np.maximum(slope[a], slope[b]))
            permitted = allowed[a] & allowed[b] & (effective <= max_slope)
            if dc and dr:
                permitted &= allowed[a + dc] & allowed[a + dr * width]
            sources.append(a[permitted]); destinations.append(b[permitted])
            costs.append(distance * (1 + weight * (effective[permitted] / reference) ** 2))
    return csr_matrix((np.concatenate(costs), (np.concatenate(sources), np.concatenate(destinations))), shape=(width * height, width * height)), allowed


report = {"python": platform.python_version(), "scipy": scipy.__version__, "method": "Independent Python pixel/edge/metric checks and SciPy sparse directed Dijkstra over the complete real 8-neighbour graph", "routes": {}}
exports = {}
for name in ["route-a", "route-b"]:
    route = json.loads((ROUTES / (name + ".json")).read_text(encoding="utf-8"))
    exports[name] = route
    assert route["status"] == "success"
    assert route["dataset"]["manifestSha256"] == hashlib.sha256(manifest_bytes).hexdigest()
    assert all(route["dataset"]["assets"][key] == digest for key, digest in before.items())
    p = route["parameters"]
    built_at = time.perf_counter()
    graph, allowed = make_graph(p["maxSlopeDeg"], p["thetaRefDeg"], p["lambda"])
    graph_ms = 1000 * (time.perf_counter() - built_at)
    cells = np.asarray(route["cells"], dtype="int32")
    assert len(set(cells.tolist())) == cells.size and allowed[cells].all()
    start = route["start"]["row"] * width + route["start"]["col"]
    goal = route["goal"]["row"] * width + route["goal"]["col"]
    assert cells[0] == start and cells[-1] == goal
    a, b = cells[:-1], cells[1:]
    dc, dr = b % width - a % width, b // width - a // width
    assert ((np.abs(dc) <= 1) & (np.abs(dr) <= 1) & ((dc != 0) | (dr != 0))).all()
    diagonal = (dc != 0) & (dr != 0)
    assert allowed[a[diagonal] + dc[diagonal]].all()
    assert allowed[a[diagonal] + dr[diagonal] * width].all()
    distance = np.hypot(dc * tf[1], dr * tf[5])
    dz = z[b] - z[a]
    angles = np.maximum(np.degrees(np.arctan(np.abs(dz) / distance)), np.maximum(slope[a], slope[b]))
    assert (angles <= p["maxSlopeDeg"]).all()
    metrics = dict(horizontalMeters=float(distance.sum()), terrainMeters=float(np.hypot(distance, dz).sum()), ascentMeters=float(np.maximum(dz, 0).sum()), descentMeters=float(np.maximum(-dz, 0).sum()), netElevationMeters=float(z[goal] - z[start]), maxSlopeDeg=float(max(slope[start], angles.max(initial=0))), totalCost=float((distance * (1 + p["lambda"] * (angles / p["thetaRefDeg"]) ** 2)).sum()))
    metric_errors = {key: abs(value - route["metrics"][key]) for key, value in metrics.items()}
    assert max(metric_errors.values()) < 1e-6
    x = tf[0] + (cells % width + 0.5) * tf[1]
    y = tf[3] + (cells // width + 0.5) * tf[5]
    assert np.array_equal(np.asarray(route["coordinates"]), np.column_stack((x, y, z[cells])))
    for field in ["selectedOrigin", "selectedDestination"]:
        point = route[field]
        lon, lat = geographic.transform(point["x"], point["y"])
        assert abs(lon - point["longitudeEastDeg"]) < 1e-10 and abs(lat - point["planetocentricLatitudeDeg"]) < 1e-10
    for exposure in route["metrics"]["exposure"]:
        interval = (angles >= exposure["lowerInclusiveDeg"]) & (angles < exposure["upperExclusiveDeg"])
        assert abs(float(distance[interval].sum()) - exposure["horizontalMeters"]) < 1e-6
    began = time.perf_counter()
    reference_cost = float(dijkstra(graph, directed=True, indices=start)[goal])
    dijkstra_ms = 1000 * (time.perf_counter() - began)
    assert abs(reference_cost - route["metrics"]["totalCost"]) < 1e-6
    report["routes"][name] = {"checked_cells": int(cells.size), "checked_edges": int(a.size), "violations": 0, "full_graph_directed_edges": graph.nnz, "dijkstra_cost": reference_cost, "astar_cost": route["metrics"]["totalCost"], "cost_absolute_difference": abs(reference_cost - route["metrics"]["totalCost"]), "metric_absolute_errors": metric_errors, "graph_build_ms": graph_ms, "dijkstra_ms": dijkstra_ms, "passed": True}

assert all(hashlib.sha256(p.read_bytes()).hexdigest() == before[p.name] for p in paths)
assert (DATA / "manifest.json").read_bytes() == manifest_bytes
report["prepared_data_unchanged"] = True
REPORTS.mkdir(parents=True, exist_ok=True)
(REPORTS / "independent-dijkstra.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.axes_grid1.anchored_artists import AnchoredSizeBar

with rasterio.open(DATA / "ortho.tif") as image, rasterio.open(DATA / "valid_mask.tif") as valid:
    shape = (image.height // 2, image.width // 2)
    pixels = np.ma.masked_where(valid.read(1, out_shape=shape) == 0, image.read(1, out_shape=shape))
    extent = [image.bounds.left / 1000, image.bounds.right / 1000, image.bounds.bottom / 1000, image.bounds.top / 1000]
fig, (map_ax, profile_ax) = plt.subplots(1, 2, figsize=(15, 7), gridspec_kw={"width_ratios": [1.2, 1]}, constrained_layout=True)
map_ax.imshow(pixels, extent=extent, cmap="gray", vmin=35, vmax=180)
map_ax.set_facecolor("#e5a9ca")
for name, label, color in [("route-a", "A · distancia mínima", "#22e6ef"), ("route-b", "B · penalización pendiente", "#ffbf39")]:
    r = exports[name]
    xyz = np.asarray(r["coordinates"])
    map_ax.plot(xyz[:, 0] / 1000, xyz[:, 1] / 1000, color=color, linewidth=2.2, label=f"{label}: {r['metrics']['horizontalMeters']:.1f} m")
    cumulative = np.r_[0, np.cumsum(np.hypot(np.diff(xyz[:, 0]), np.diff(xyz[:, 1])))]
    profile_ax.plot(cumulative, xyz[:, 2], color=color, linewidth=2, label=label)
for field, label in [("selectedOrigin", "Origen demo"), ("selectedDestination", "Destino demo")]:
    point = exports["route-a"][field]
    map_ax.plot(point["x"] / 1000, point["y"] / 1000, 'o', markerfacecolor="white", markeredgecolor="black", markersize=7)
    map_ax.annotate(label, (point["x"] / 1000, point["y"] / 1000), xytext=(7, 7), textcoords="offset points", color="white", bbox={"facecolor": "black", "alpha": 0.7, "pad": 2})
map_ax.set_xlabel("Este local marciano (km)"); map_ax.set_ylabel("Norte local marciano (km)")
map_ax.add_artist(AnchoredSizeBar(map_ax.transData, 0.5, "500 m", loc="lower left", color="black", frameon=True, size_vertical=0.008))
map_ax.legend(loc="lower right", fontsize=8, facecolor="#eeeeee")
profile_ax.set_xlabel("Distancia horizontal acumulada (m)"); profile_ax.set_ylabel("Elevación del DEM medio de 10 m (m)")
profile_ax.set_facecolor("#182130"); profile_ax.grid(alpha=0.2); profile_ax.legend(fontsize=8)
profile_ax.set_title("Perfiles sobre la cuadrícula real · mismos extremos")
fig.suptitle("Mars Pathfinder · The Meowrtian · Jezero\nA* sobre modelo de 10 m, límite 15° · no certificación de seguridad EVA\nImagen NASA/JPL/University of Arizona · rosa = datos conjuntos excluidos", fontsize=12)
fig.savefig(REPORTS / "routes-jezero.png", dpi=160)
plt.close(fig)
print(json.dumps(report, indent=2))
