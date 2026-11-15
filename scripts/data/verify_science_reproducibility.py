"""Repeat only new vector/target processing; source imagery and prepared terrain remain untouched."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[2]
folder=ROOT/'public/data/jezero-science-v1'
def hashes():
    return {str(p.relative_to(folder)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.rglob('*') if p.is_file()}
before=hashes()
for script in ['prepare_geology.py','prepare_objectives.py']:
    subprocess.run([sys.executable,str(ROOT/'scripts/data'/script)],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
subprocess.run(['node',str(ROOT/'scripts/data/seal_science.mjs')],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
after=hashes()
report={'operation':'Repeat vector reprojection, clipping and objective selection from same official inputs; photos preserved', 'allScienceFilesIdentical':before==after,'beforeSha256':before,'afterSha256':after}
(ROOT/'docs/science-validation/reproducibility.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
assert before==after, 'Science package changed when repeated'
print(f'{len(after)} science files identical after repeating new processing')
