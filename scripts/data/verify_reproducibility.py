"""Rerun preparation and compare actual output bytes, excluding report timestamps."""
import json
import subprocess
import sys
from datetime import datetime, timezone

from .inspect_hirise import ROOT, REPORT, write_json

manifest = ROOT / "data/processed/jezero-hirise-v1/manifest.json"
before = json.loads(manifest.read_text(encoding="utf-8"))
run = subprocess.run([sys.executable, "-m", "scripts.data.prepare_hirise"], cwd=ROOT, capture_output=True, text=True)
(REPORT / "prepare-repeat.log").write_text(run.stdout + run.stderr, encoding="utf-8")
if run.returncode:
    raise RuntimeError(f"Repeat preparation failed with code {run.returncode}; see prepare-repeat.log")
after = json.loads(manifest.read_text(encoding="utf-8"))
old = {x["path"]: x["sha256"] for x in before["outputs"]}
new = {x["path"]: x["sha256"] for x in after["outputs"]}
result = {"checked_at_utc": datetime.now(timezone.utc).isoformat(), "command": "python -m scripts.data.prepare_hirise", "outputs_compared": len(old), "same_output_set": old.keys() == new.keys(), "all_output_sha256_identical": old == new, "changed_outputs": [x for x in old if old[x] != new.get(x)], "configuration_identical": before["configuration"] == after["configuration"], "scope": "Same locked environment, inputs and configuration on this Windows machine; not a claim across different GDAL versions/platforms"}
write_json(REPORT / "reproducibility.json", result)
print(json.dumps(result))
if old != new:
    raise RuntimeError("Output hashes changed on repeat")
