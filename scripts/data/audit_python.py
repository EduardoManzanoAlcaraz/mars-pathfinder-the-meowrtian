"""Record the isolated GIS/test toolchain and its declared licenses; tools aren't shipped in out/."""
import importlib.metadata as metadata
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[2]
packages=[]
for dist in metadata.distributions():
    m=dist.metadata
    license_files=[]
    for item in dist.files or []:
        if any(term in item.name.lower() for term in ['license','licence','copying','notice']) and item.suffix.lower() in ['.txt','.md','']:
            path=Path(dist.locate_file(item))
            if path.is_file():
                import hashlib
                license_files.append({'path':str(item),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'text':path.read_text(encoding='utf8',errors='replace')})
    packages.append({'name':m['Name'],'version':dist.version,'summary':m.get('Summary'),'licenseExpression':m.get('License-Expression'),'license':m.get('License'),'classifiers':m.get_all('Classifier'),'licenseFiles':license_files,'projectURLs':m.get_all('Project-URL')})
(ROOT/'docs/science-validation/python-licenses.json').write_text(json.dumps({'python':sys.version,'scope':'Local isolated processing/verification tools only; not distributed in static application','packages':sorted(packages,key=lambda p:p['name'].lower())},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
freeze=subprocess.check_output([sys.executable,'-m','pip','freeze'],text=True)
(ROOT/'requirements-geospatial.lock.txt').write_text(freeze,encoding='utf8')
print(f'{len(packages)} isolated Python distributions recorded')
