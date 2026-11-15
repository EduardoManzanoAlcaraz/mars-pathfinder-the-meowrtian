"""Lightweight context from the existing SIM 3464 FileGDB; never used by A*."""
import hashlib
import json
from pathlib import Path
from pyogrio.raw import read
import pyogrio
from pyproj import CRS, Transformer
from shapely import from_wkb
from shapely.geometry import mapping, shape, box
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[2]
gdb = next((ROOT / 'data/raw/usgs-sim3464/extracted').rglob('Nili.gdb'))
manifest_bytes = (ROOT / 'data/processed/jezero-hirise-v1/manifest.json').read_bytes()
manifest = json.loads(manifest_bytes)
visual = json.loads((ROOT / 'public/data/jezero-hirise-v1/visuals.json').read_text())
info = pyogrio.read_info(gdb, layer='GeoUnits_v1')
forward = Transformer.from_crs(CRS.from_wkt(info['crs']), CRS.from_proj4(manifest['local_crs_proj']), always_xy=True)
reverse = Transformer.from_crs(CRS.from_proj4(manifest['local_crs_proj']), CRS.from_wkt(info['crs']), always_xy=True)
meta, fids, wkbs, fields = read(gdb, layer='GeoUnits_v1', where="symbol IN ('NHjf1','NHjf2','Njf')", return_fids=True)
features, geometries, errors, roundtrips = [], [], [], []
def rounded(value):
    if isinstance(value, (list, tuple)): return [rounded(x) for x in value]
    return round(value, 1)
for i, wkb in enumerate(wkbs):
    original = transform(forward.transform, from_wkb(wkb))
    assert original.is_valid
    tolerance = 25
    for attempt in range(10):
        simplified = original.simplify(tolerance, preserve_topology=True)
        geometry = mapping(simplified)
        geometry['coordinates'] = rounded(geometry['coordinates'])
        final = shape(geometry)
        assert final.is_valid and not final.is_empty
        error = original.hausdorff_distance(final)
        if error <= 25.1: break
        tolerance /= 2
    assert error <= 25.1
    properties = {str(k): str(v[i]) for k, v in zip(meta['fields'], fields) if k in ['name', 'symbol']}
    properties['simplificationToleranceM'] = tolerance
    features.append({'id': int(fids[i]), 'properties': properties, 'geometry': geometry})
    geometries.append(original); errors.append(error)
    p = original.representative_point(); x, y = reverse.transform(p.x, p.y); rx, ry = forward.transform(x, y)
    roundtrips.append(((rx - p.x)**2 + (ry - p.y)**2)**.5)
bounds = unary_union(geometries).bounds
padding = .06 * max(bounds[2] - bounds[0], bounds[3] - bounds[1])
extent = [bounds[0] - padding, bounds[1] - padding, bounds[2] + padding, bounds[3] + padding]
assert box(*extent).covers(box(*visual['extent']))
photos = json.loads((ROOT / 'public/data/jezero-science-v1/photos.json').read_text())['photos']
data = {'schema': 'mars-pathfinder-regional-context-v1', 'datasetId': 'jezero-overview-v1',
        'topographyManifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
        'crsProj': manifest['local_crs_proj'], 'coordinateConvention': 'Local Mars projected metres; north up; not Earth/WGS84',
        'extent': extent, 'studyExtent': visual['extent'], 'features': features,
        'roverRecords': [{'imageId': p['imageId'], 'xy': p['xy'], 'rmc': p['rmc'], 'sol': p['sol']} for p in photos],
        'source': {'title': 'Sun & Stack (2020), USGS SIM 3464', 'url': 'https://doi.org/10.3133/sim3464', 'layer': 'GeoUnits_v1',
                   'zipSha256': next(x['sha256'] for x in json.loads((ROOT/'docs/science-validation/usgs-downloads.json').read_text())['files'] if x['name'] == 'sim3464_database.zip')},
        'derivation': {'simplificationToleranceM': 25, 'coordinateRoundingM': .1, 'maximumMeasuredHausdorffM': max(errors),
                       'warning': 'Simplified mapped floor and fan units only; other units omitted. Not a crater-rim trace, image mosaic or navigation coverage.',
                       'geologyRegistrationOffsetM': [100, 200], 'routingUse': False}}
output = ROOT / 'public/data/jezero-overview-v1/context.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf8')
report = {'sourceLayer': 'GeoUnits_v1', 'features': len(features), 'sourceFids': [x['id'] for x in features],
          'extent': extent, 'studyExtent': visual['extent'], 'crs': manifest['local_crs_proj'],
          'maxHausdorffM': max(errors), 'maxTransformRoundtripM': max(roundtrips),
          'allGeometriesValid': True, 'studyAreaContained': True, 'bytes': output.stat().st_size,
          'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
report_path = ROOT / 'docs/jury-improvement/overview-preparation.json'
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
