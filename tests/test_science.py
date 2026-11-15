"""Tests against downloaded NASA/USGS sources, distinct from synthetic fixtures."""
import hashlib
import json
from pathlib import Path
import numpy as np
import pytest
import rasterio.warp
from pyogrio.raw import read
from pyproj import Transformer
from shapely import from_wkb
from shapely.geometry import Point, box, shape
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
SCI=ROOT/'public/data/jezero-science-v1'
RAW=ROOT/'data/raw/resource-discovery'
geo=json.loads((SCI/'geology.json').read_text(encoding='utf8'))
objectives=json.loads((SCI/'objectives.json').read_text(encoding='utf8'))['objectives']
photos=json.loads((SCI/'photos.json').read_text(encoding='utf8'))['photos']
topo=json.loads((ROOT/'data/processed/jezero-hirise-v1/manifest.json').read_text(encoding='utf8'))

@pytest.fixture(scope='module')
def source_units():
    gdb=next((ROOT/'data/raw/usgs-sim3464/extracted').rglob('Nili.gdb'))
    bounds=json.loads((ROOT/'docs/science-validation/geology-preparation.json').read_text())['filterBoundsSourceM']
    meta,fids,geoms,fields=read(gdb,layer='GeoUnits_v1',bbox=tuple(bounds),return_fids=True)
    return meta,{int(fid):(from_wkb(geoms[i]),{str(k):v[i] for k,v in zip(meta['fields'],fields)}) for i,fid in enumerate(fids)}

def test_valid_geology_clipped_complete_without_artificial_shift():
    polygons=[shape(f['geometry']) for f in geo['features']]
    crop=box(*geo['extent'])
    assert all(x.is_valid and x.within(crop) for x in polygons)
    assert crop.difference(unary_union(polygons)).area<1e-5
    assert sum(p.area for p in polygons)-unary_union(polygons).area<1e-5
    assert geo['registration']['shiftAppliedMeters']==[0,0]
    assert geo['registration']['documentedOffsetMeters']==[100,200]

def test_original_identifiers_and_names_preserved(source_units):
    _,originals=source_units
    assert {f['properties']['symbol'] for f in geo['features']}=={'NHjf2','Nle','Njf','Nue','Aeb'}
    for f in geo['features']:
        _,attributes=originals[f['id']]
        assert f['properties']['name']==attributes['name']
        assert f['properties']['symbol']==attributes['symbol']

def test_actual_geometry_registration_against_gdal_transform(source_units):
    meta,originals=source_units
    forward=Transformer.from_crs(meta['crs'],topo['local_crs_proj'],always_xy=True)
    reverse=Transformer.from_crs(topo['local_crs_proj'],meta['crs'],always_xy=True)
    for f in geo['features']:
        point=shape(f['geometry']).representative_point()
        source_xy=reverse.transform(point.x,point.y)
        assert originals[f['id']][0].covers(Point(*source_xy))
        gdal_x,gdal_y=rasterio.warp.transform(meta['crs'],topo['local_crs_wkt'],[source_xy[0]],[source_xy[1]])
        assert np.hypot(gdal_x[0]-point.x,gdal_y[0]-point.y)<0.001
        assert np.hypot(*(np.array(forward.transform(*source_xy))-np.array([point.x,point.y])))<0.001

def test_three_targets_in_original_published_units_and_valid_grid(source_units):
    meta,originals=source_units
    inverse=Transformer.from_crs(topo['local_crs_proj'],meta['crs'],always_xy=True)
    r=topo['routing_grid'];w=r['width'];t=r['transform_gdal']
    valid=np.fromfile(ROOT/'data/processed/jezero-hirise-v1'/r['paths']['valid_binary'],dtype='uint8')
    slope=np.fromfile(ROOT/'data/processed/jezero-hirise-v1'/r['paths']['slope_binary'],dtype='<f4')
    assert len(objectives)==3
    for o in objectives:
        c=o['cell'];i=c['row']*w+c['col']
        assert valid[i]==1 and slope[i]<=15
        assert o['xy']==[t[0]+(c['col']+.5)*t[1],t[3]+(c['row']+.5)*t[5]]
        assert originals[o['sourceFid']][0].covers(Point(*inverse.transform(*o['xy'])))
        assert originals[o['sourceFid']][1]['symbol']==o['unitSymbol']
        assert o['distanceToClippedUnitBoundaryM']>200
        assert o['sameTraversableComponentAsDemo15Deg']
        assert 'The Meowrtian' in o['designation'] and len(o['sources'])>=2

def test_photos_exact_same_sol_rmc_join_and_pose_meaning():
    waypoints=json.loads((RAW/'rover-waypoints-official.json').read_text())['features']
    assert len(photos)==2
    for photo in photos:
        originals=json.loads((ROOT/f"data/raw/perseverance-photos/{photo['imageId']}.json").read_text())
        image=originals['image'];assert image['imageid']==photo['imageId']
        matches=[x for x in waypoints if x['properties']['RMC']==photo['rmc'] and x['properties']['sol']==image['sol']]
        assert len(matches)==1
        p=matches[0]['properties'];assert p['site']==int(image['site']) and p['drive']==int(image['drive'])
        assert [photo['longitudeEastDeg'],photo['latitudePlanetocentricDeg']]==matches[0]['geometry']['coordinates'][:2]
        assert 'no es la posición del terreno' in photo['locationMeaningEs']
        assert photo['uncertainty']['absoluteAccuracyM'] is None
        assert hashlib.sha256((SCI/photo['file']).read_bytes()).hexdigest()==photo['sha256']

def test_science_package_hashes_and_topography_identity():
    package=json.loads((SCI/'manifest.json').read_text())
    assert package['geologyAffectsRouting'] is False
    assert package['crsProj']==topo['local_crs_proj']
    assert package['topographyManifestSha256']==hashlib.sha256((ROOT/'data/processed/jezero-hirise-v1/manifest.json').read_bytes()).hexdigest()
    for entry in package['files']:
        bytes_=(SCI/entry['file']).read_bytes()
        assert len(bytes_)==entry['bytes'] and hashlib.sha256(bytes_).hexdigest()==entry['sha256']
