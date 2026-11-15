import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(), checkout = path.resolve('.cache/github-publication/repository');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
const checks = JSON.parse(await fs.readFile('docs/jury-release-20261115/checks.json', 'utf8'));
assert.equal(checks.passed, true); assert.equal(checks.sourceCommit, commit);
const runtimePaths = ['app', 'components', 'lib', 'workers', 'public', 'scripts/web', 'package.json', 'package-lock.json', 'next.config.mjs', 'scripts/routing/build-worker.mjs', 'data/routes', 'data/processed'];
assert.equal(execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...runtimePaths], { cwd: checkout, encoding: 'utf8' }).trim(), '', 'Build inputs must match the recorded source commit');
assert.equal(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...runtimePaths], { cwd: checkout, encoding: 'utf8' }).trim(), '', 'No uncommitted build input may enter the payload');
const inputFiles = [];
async function walk(folder) {
  for (const e of await fs.readdir(path.join(checkout, folder), { withFileTypes: true })) {
    const file = `${folder}/${e.name}`;
    if (e.isSymbolicLink()) throw new Error('Unexpected source symlink');
    if (e.isDirectory()) await walk(file); else inputFiles.push(file);
  }
}
for (const folder of ['app', 'components', 'lib', 'workers', 'public', 'scripts/web']) await walk(folder);
inputFiles.push('package.json', 'package-lock.json', 'next.config.mjs', 'scripts/routing/build-worker.mjs', 'data/routes/jezero-hirise-v1/route-a.json');
for (const name of await fs.readdir(path.join(checkout, 'data/processed/jezero-hirise-v1'))) if (/\.(json|f32|u8)$/.test(name)) inputFiles.push(`data/processed/jezero-hirise-v1/${name}`);
const entries = [];
for (const file of [...new Set(inputFiles)].sort()) { const bytes = await fs.readFile(path.join(checkout, file)); entries.push({ path: file, sha256: createHash('sha256').update(bytes).digest('hex') }); }
const runtimeInputsSha256 = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
const marker = { schema: 'mars-pathfinder-release-v1', generatedAtUtc: new Date().toISOString(), sourceCommit: commit,
  sourceRepository: 'https://github.com/EduardoManzanoAlcaraz/mars-pathfinder-the-meowrtian', runtimeInputsSha256,
  appVersion: '0.1.0', engineVersion: '1.0.0', dataset: 'jezero-hirise-v1', topographyManifestSha256: '31717c6421490dfea50ea17d8a4131d9b13408d8761e03d649e2588774009c85',
  tests: checks.tests, runtimeInputs: entries };
await fs.writeFile(path.join(checkout, 'out/release.json'), JSON.stringify(marker, null, 2) + '\n');
const destination = path.resolve('out'), preserved = path.resolve('.cache/jury-release-20261115/root-out-before-refresh');
for (const candidate of [destination, preserved]) assert.ok(candidate.startsWith(root + path.sep), 'Targets must remain inside this workspace');
try { await fs.access(preserved); throw new Error('Preserve the previous root build; do not overwrite backup'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if ((await fs.lstat(destination)).isSymbolicLink()) throw new Error('Refuse to move a linked output directory');
await fs.rename(destination, preserved);
await fs.cp(path.join(checkout, 'out'), destination, { recursive: true, errorOnExist: true });
await fs.writeFile('docs/jury-release-20261115/release.json', JSON.stringify(marker, null, 2) + '\n');
console.log(JSON.stringify({ sourceCommit: commit, runtimeInputsSha256, inputFiles: entries.length, copiedBuild: true }));
