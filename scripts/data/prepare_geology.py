"""SIM 3464 -> exact local Mars CRS and AOI, without shifting contacts or changing routing data."""
import hashlib
import json
from pathlib import Path
import numpy as np
import pyogrio
from pyogrio.raw import read
from pyproj import CRS, Transformer
from shapely import from_wkb, make_valid
from shapely.geometry import box, mapping
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw/usgs-sim3464'
OUT = ROOT / 'public/data/jezero-science-v1'
REPORT = ROOT / 'docs/science-validation'
OUT.mkdir(parents=True, exist_ok=True)
prepared = ROOT / 'data/processed/jezero-hirise-v1/manifest.json'
manifest_bytes = prepared.read_bytes()
manifest = json.loads(manifest_bytes)
visual = json.loads((ROOT / 'public/data/jezero-hirise-v1/visuals.json').read_text(encoding='utf8'))
extent = visual['extent']
clip = box(*extent)
gdb = next((RAW / 'extracted').rglob('Nili.gdb'))
info = pyogrio.read_info(gdb, layer='GeoUnits_v1')
source = CRS.from_wkt(info['crs'])
target = CRS.from_proj4(manifest['local_crs_proj'])
forward = Transformer.from_crs(source, target, always_xy=True)
reverse = Transformer.from_crs(target, source, always_xy=True)
bounds = reverse.transform_bounds(*extent, densify_pts=101)
meta, fids, wkbs, fields = read(gdb, layer='GeoUnits_v1', bbox=bounds, return_fids=True)
features, fixes = [], []
geometries, unit_areas = [], {}
roundtrip = []
for i, wkb in enumerate(wkbs):
    original = from_wkb(wkb)
    if not original.is_valid:
        fixes.append(int(fids[i])); original = make_valid(original)
    projected = transform(forward.transform, original)
    cropped = projected.intersection(clip)
    if cropped.is_empty or cropped.area <= 0: continue
    if not cropped.is_valid: raise ValueError('Invalid clipped polygon')
    properties = {str(name): values[i].item() if hasattr(values[i], 'item') else values[i] for name, values in zip(meta['fields'], fields)}
    properties = {k: properties[k] for k in ['unit', 'name', 'symbol', 'symbol_noSub', 'subscript', 'ORIG_FID', 'Color_ID']}
    properties.update(sourceFid=int(fids[i]), clippedAreaM2=cropped.area)
    features.append({'type': 'Feature', 'id': int(fids[i]), 'properties': properties, 'geometry': mapping(cropped)})
    geometries.append(cropped)
    unit_areas[properties['symbol']] = unit_areas.get(properties['symbol'], 0) + cropped.area
    # Numerical transformation checks on actual source vertices around the crop.
    p = cropped.representative_point(); a = reverse.transform(p.x, p.y); b = forward.transform(*a)
    roundtrip.append(float(np.hypot(b[0]-p.x, b[1]-p.y)))
union = unary_union(geometries)
collection = {'schema': 'mars-pathfinder-local-geology-v1', 'type': 'FeatureCollection',
              'coordinateConvention': 'Mars local projected metres, NOT RFC7946/WGS84 GeoJSON',
              'datasetId': 'jezero-science-v1', 'topographyDatasetId': manifest['dataset_id'],
              'topographyManifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
              'crsProj': manifest['local_crs_proj'], 'sourceCrsWkt': info['crs'], 'extent': extent,
              'source': {'title': 'Geologic map of Jezero crater and the Nili Planum region, Mars', 'authors': ['Vivian Z. Sun', 'Kathryn M. Stack'], 'year': 2020, 'agency': 'USGS', 'publication': 'SIM 3464', 'doi': '10.3133/sim3464', 'url': 'https://pubs.usgs.gov/publication/sim3464', 'scaleDenominator': 75000, 'layer': 'GeoUnits_v1', 'zipSha256': next(f['sha256'] for f in json.loads((REPORT/'usgs-downloads.json').read_text())['files'] if f['name']=='sim3464_database.zip')},
              'registration': {'documentedOffsetMeters': [100,200], 'reference': '2020 surface-operations CTX mosaic, per official README; not measured residual against this HiRISE crop', 'shiftAppliedMeters': [0,0], 'navigationUse': 'Context only; never barriers or costs', 'warningEs': 'SIM 3464: desfases documentados de 100–200 m frente al CTX de operaciones. Reproyectar no los corrige. Contactos orientativos, sin efecto sobre A*.'},
              'provenance': 'USGS published interpretation; local reprojection and clipping by The Meowrtian; display colors by team', 'features': features}
(OUT / 'geology.json').write_text(json.dumps(collection, ensure_ascii=False, separators=(',',':'))+'\n', encoding='utf8')
report = {'sourceFeatures': int(info['features']), 'bboxCandidates': len(fids), 'clippedFeatures': len(features), 'sourceInvalidRepairedFids': fixes, 'allClippedValid': all(x.is_valid for x in geometries), 'areaM2': clip.area, 'geologyUnionAreaM2': union.area, 'uncoveredAreaM2': clip.difference(union).area, 'overlappingAreaM2': sum(x.area for x in geometries)-union.area, 'unitAreasM2': unit_areas, 'maxNumericalRoundtripErrorM': max(roundtrip), 'sourceWkt': info['crs'], 'targetProj': manifest['local_crs_proj'], 'filterBoundsSourceM': bounds, 'extent': extent, 'outputSha256': hashlib.sha256((OUT/'geology.json').read_bytes()).hexdigest(), 'outputBytes': (OUT/'geology.json').stat().st_size}
(REPORT / 'geology-preparation.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
print(json.dumps(report, indent=2))
