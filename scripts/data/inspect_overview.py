"""Read-only inspection of already downloaded USGS context; no downloads."""
from pathlib import Path
from pyogrio.raw import read
from shapely import from_wkb
import pyogrio

p = next(Path('data/raw/usgs-sim3464/extracted').rglob('Nili.gdb'))
for layer in ['Nomenclature', 'SurfaceFeatures', 'LocationFeatures']:
    info = pyogrio.read_info(p, layer=layer)
    print(layer, info['features'], info['fields'])
    m, f, w, a = read(p, layer=layer, return_fids=True)
    for i in range(min(len(f), 8)):
        print(int(f[i]), {str(k): str(v[i]) for k, v in zip(m['fields'], a) if not str(k).startswith('SHAPE')}, from_wkb(w[i]).bounds)
m, f, w, a = read(p, layer='GeoUnits_v1', where="symbol IN ('NHjf2','Njf','NHjf1')", return_fids=True)
for i in range(len(f)):
    print('Unit', int(f[i]), {str(k): str(v[i]) for k, v in zip(m['fields'], a) if k in ['name', 'symbol']}, from_wkb(w[i]).bounds)
