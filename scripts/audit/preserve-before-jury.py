"""Extract and verify only the former static package from the existing local backup."""
import hashlib
import json
import zipfile
from pathlib import Path
root = Path.cwd()
metadata = json.loads((root / '.cache/jury-release-20261115/before/docs/deployment-validation/backup.json').read_text(encoding='utf8'))
archive = root / metadata['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == metadata['sha256']
preflight = json.loads((root / '.cache/jury-release-20261115/before/docs/deployment-validation/preflight.json').read_text(encoding='utf8'))
target = (root / '.cache/jury-release-20261115/previous-out').resolve()
target.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as z:
    for entry in preflight['entries']:
        relative = Path(entry['path'])
        output = (target / relative).resolve()
        assert output.is_relative_to(target)
        data = z.read('out/' + relative.as_posix())
        assert len(data) == entry['bytes']
        assert hashlib.sha256(data).hexdigest() == entry['sha256']
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
report = {'verifiedAtUtc': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
          'sourceCommit': '33ae224304735917200f2cbdf4f28c628affca89',
          'gitTag': 'before-jury-release-20261115', 'previousDeploy': '6af97dee2c4df4cb0f9da6cc',
          'sourceArchive': metadata['archive'], 'sourceArchiveSha256': metadata['sha256'],
          'recoveryDirectory': target.relative_to(root).as_posix(), 'files': len(preflight['entries']),
          'bytes': sum(x['bytes'] for x in preflight['entries']), 'allFilesSha256Verified': True}
(root / 'docs/jury-release-20261115').mkdir(exist_ok=True)
(root / 'docs/jury-release-20261115/recovery.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
