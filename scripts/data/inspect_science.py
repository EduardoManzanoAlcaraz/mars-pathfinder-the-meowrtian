"""Read-only inspection of official SIM 3464; extract only vectors and metadata."""
import hashlib
import json
import zipfile
from pathlib import Path
import pyogrio
from pyogrio.raw import read
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw/usgs-sim3464'
OUT = ROOT / 'docs/science-validation'
OUT.mkdir(exist_ok=True, parents=True)
with zipfile.ZipFile(RAW / 'sim3464_database.zip') as archive:
    bad = archive.testzip()
    if bad: raise ValueError(f'ZIP CRC failed: {bad}')
    selected = [x for x in archive.namelist() if '.gdb/' in x.lower() or x.lower().endswith(('.prj', '.xml', '.txt'))]
    extracted = []
    for name in selected:
        destination = (RAW / 'extracted' / name).resolve()
        if not destination.is_relative_to((RAW / 'extracted').resolve()): raise ValueError('Unsafe ZIP path')
        archive.extract(name, RAW / 'extracted')
        if destination.is_file(): extracted.append({'path': str(destination.relative_to(ROOT)).replace('\\', '/'), 'bytes': destination.stat().st_size, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()})
    listing = [{'name': x.filename, 'bytes': x.file_size, 'compressedBytes': x.compress_size} for x in archive.infolist()]
gdb = next((RAW / 'extracted').rglob('Nili.gdb'))
layers = pyogrio.list_layers(gdb).tolist()
info = pyogrio.read_info(gdb, layer='GeoUnits_v1')
meta, fids, geometries, fields = read(gdb, layer='GeoUnits_v1', return_fids=True)
samples = []
for i in range(min(8, len(fids))):
    samples.append({'fid': int(fids[i]), **{str(name): values[i].item() if hasattr(values[i], 'item') else values[i] for name, values in zip(meta['fields'], fields)}})
units = {}
for name, values in zip(meta['fields'], fields):
    if values.dtype.kind in 'OU': units[str(name)] = sorted({str(v) for v in values})[:80]
report = {'zipCRCAllMembersPassed': True, 'zipMembers': listing, 'extracted': extracted, 'gdb': str(gdb.relative_to(ROOT)).replace('\\', '/'), 'pyogrio': pyogrio.__version__, 'gdal': pyogrio.__gdal_version_string__, 'layers': layers, 'info': {k: v.tolist() if hasattr(v, 'tolist') else v for k, v in info.items()}, 'samples': samples, 'unitFields': units}
(OUT / 'sim3464-inspection.json').write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str) + '\n', encoding='utf8')
pdf = pymupdf.open(RAW / 'sim3464.pdf')
(OUT / 'sim3464-map-text.txt').write_text('\n\n'.join(f'PAGE {i+1}\n{page.get_text()}' for i, page in enumerate(pdf)), encoding='utf8')
page = pdf[0]
page.get_pixmap(matrix=pymupdf.Matrix(1800 / page.rect.width, 1800 / page.rect.width)).save(OUT / 'sim3464-sheet.png')
print(json.dumps({'zipCRC': True, 'layers': layers, 'features': len(fids), 'fields': meta['fields'].tolist(), 'units': units, 'pdfPages': len(pdf)}, indent=2))
