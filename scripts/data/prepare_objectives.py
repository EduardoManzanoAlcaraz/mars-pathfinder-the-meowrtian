"""Choose three clearly team-defined science targets from real SIM polygons and valid routing cells."""
import hashlib
import json
from pathlib import Path
import numpy as np
from pyproj import CRS, Transformer
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from shapely import points, contains, distance
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'data/processed/jezero-hirise-v1'
OUT=ROOT/'public/data/jezero-science-v1'
manifest=json.loads((DATA/'manifest.json').read_text(encoding='utf8'))
geo=json.loads((OUT/'geology.json').read_text(encoding='utf8'))
r=manifest['routing_grid']; w,h=r['width'],r['height']; t=r['transform_gdal']
z=np.fromfile(DATA/r['paths']['dem_binary'],dtype='<f4').reshape(h,w)
s=np.fromfile(DATA/r['paths']['slope_binary'],dtype='<f4').reshape(h,w)
valid=np.fromfile(DATA/r['paths']['valid_binary'],dtype='uint8').reshape(h,w)
usable=(valid==1)&np.isfinite(z)&np.isfinite(s)&(z!=-9999)&(s!=-9999)&(s<=15)&(s>=0)
ids=np.arange(w*h).reshape(h,w)
rows,cols=np.indices((h,w)); x=t[0]+(cols+.5)*t[1]; y=t[3]+(rows+.5)*t[5]
src_ids,dst_ids=[],[]
for dc,dr in [(1,0),(0,1),(1,1),(-1,1)]:
    ra,rb=(slice(0,h-dr),slice(dr,h)); ca,cb=(slice(max(0,-dc),min(w,w-dc)),slice(max(0,dc),min(w,w+dc)))
    ok=usable[ra,ca]&usable[rb,cb]
    ok&=np.degrees(np.arctan2(np.abs(z[ra,ca]-z[rb,cb]),np.hypot(dc*t[1],dr*t[5])))<=15
    if dc and dr: ok&=usable[ra,cb]&usable[rb,ca]
    src_ids.append(ids[ra,ca][ok]);dst_ids.append(ids[rb,cb][ok])
aa=np.concatenate(src_ids);bb=np.concatenate(dst_ids)
graph=coo_matrix((np.ones(len(aa),dtype=np.uint8),(aa,bb)),shape=(w*h,w*h)).tocsr()
_,labels=connected_components(graph,directed=False)
demo=json.loads((ROOT/'public/data/jezero-hirise-v1/demo-query.json').read_text())
component=labels[demo['start']['row']*w+demo['start']['col']]
common=usable.ravel()&(labels==component)
centres=points(x.ravel(),y.ravel())
lonlat=Transformer.from_crs(CRS.from_proj4(manifest['local_crs_proj']),CRS.from_proj4('+proj=longlat +R=3396190 +type=crs'),always_xy=True)
questions={
 'NHjf2': ('M1 · Depósito de abanico', 'Comparar textura, relieve y posibles exposiciones estratificadas de la unidad cartografiada con el suelo del cráter; evaluar su contexto de depósito deltaico interpretado en SIM 3464. La estratificación en este punto requiere observación de campo.'),
 'Nle': ('M2 · Unidad inferior erosionada', 'Documentar morfología y relaciones de erosión de la unidad Nle; contrastar con las interpretaciones deposicionales alternativas publicadas, sin asumir composición mineral en este punto.'),
 'Njf': ('M3 · Suelo de Jezero', 'Caracterizar textura, craterización y relieve del suelo cartografiado y compararlos con el abanico y la unidad Nle. No se identifica aquí una muestra ni una estación de Perseverance.'),
}
objectives=[]
for symbol,(label,question) in questions.items():
    members=[f for f in geo['features'] if f['properties']['symbol']==symbol]
    unit=unary_union([shape(f['geometry']) for f in members])
    inside=contains(unit,centres)&usable.ravel()
    same=inside&common
    candidates=np.flatnonzero(same if np.any(same) else inside)
    if not len(candidates): raise ValueError(f'No valid target in {symbol}')
    # Greatest distance to published unit boundaries; deterministic first tie.
    separation=distance(centres[candidates],unit.boundary)
    selected=int(candidates[int(np.argmax(separation))])
    col,row=selected%w,selected//w; px,py=float(x[row,col]),float(y[row,col])
    member=next(f for f in members if shape(f['geometry']).covers(centres[selected]))
    lon,lat=lonlat.transform(px,py)
    objectives.append({'id':f'meowrtian-{symbol.lower()}', 'label':label, 'designation':'Objetivo propuesto por The Meowrtian; no es nombre ni estación oficial NASA/USGS',
      'xy':[px,py], 'cell':{'col':col,'row':row}, 'longitudeEastDeg':lon,'latitudePlanetocentricDeg':lat,
      'elevationMeters':float(z[row,col]),'routingSlopeMaxDeg':float(s[row,col]),'routingMask':int(valid[row,col]),
      'sameTraversableComponentAsDemo15Deg':bool(common[selected]),'validCandidateCellsInUnit':int(inside.sum()),'sameComponentCandidateCells':int(same.sum()),
      'unitSymbol':symbol,'unitName':member['properties']['name'],'sourceFid':member['id'],
      'distanceToClippedUnitBoundaryM':float(distance(centres[selected],unit.boundary)),
      'scientificObjective':question,'method':'Team-selected centre of a valid 10 m cell, inside the published polygon, maximizing interior margin; prefer component containing demo start under 15 degree cell/edge and corner constraints',
      'uncertainty':{'geologyRegistrationOffsetM':[100,200],'routingCellSizeM':10,'coordinatePrecisionIsAccuracy':False,'noteEs':'La coordenada del centro de celda está comprobada en la rejilla. La pertenencia geológica hereda el desfase 100–200 m del mapa; no localiza un afloramiento con precisión de 10 m ni demuestra transitabilidad física.'},
      'sources':[{'title':'Sun & Stack (2020), USGS SIM 3464, GeoUnits_v1 y descripción de unidades','url':'https://doi.org/10.3133/sim3464','sourceFid':member['id']},{'title':'HiRISE: DTM ESP_045994_1985 / ESP_046060_1985 y orto RED_C','url':'https://www.uahirise.org/dtm/ESP_045994_1985'}]})
payload={'schema':'mars-pathfinder-science-objectives-v1','datasetId':'jezero-science-v1','crsProj':manifest['local_crs_proj'],'topographyManifestSha256':geo['topographyManifestSha256'],'geologySha256':hashlib.sha256((OUT/'geology.json').read_bytes()).hexdigest(),'provenance':'The Meowrtian selections derived from official USGS interpretation and real HiRISE grid; not official named sites','objectives':objectives}
(OUT/'objectives.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(ROOT/'docs/science-validation/objectives-preparation.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps([{'id':p['id'],'unit':p['unitName'],'cell':p['cell'],'longitude':p['longitudeEastDeg'],'latitude':p['latitudePlanetocentricDeg'],'marginM':p['distanceToClippedUnitBoundaryM'],'sameComponent':p['sameTraversableComponentAsDemo15Deg']} for p in objectives],indent=2))
