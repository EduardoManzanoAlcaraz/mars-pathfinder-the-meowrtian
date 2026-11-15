// Build-time Node only: copy verified routing assets and the existing worker.
// Scientific rendering is done once by prepare_visuals.py, not on Netlify.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const source = resolve('data/processed/jezero-hirise-v1');
const target = resolve('public/data/jezero-hirise-v1');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(target, { recursive: true }); await mkdir('public/workers', { recursive: true });
const manifestBytes = await readFile(resolve(source, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
const visuals = JSON.parse(await readFile(resolve(target, 'visuals.json'), 'utf8'));
assert.equal(visuals.preparedManifestSha256, hash(manifestBytes), 'Visuals belong to a different prepared dataset');
for (const role of ['dem_binary', 'slope_binary', 'valid_binary']) {
  const file = manifest.routing_grid.paths[role];
  const expected = manifest.outputs.find(x => x.path.endsWith('/' + file));
  const bytes = await readFile(resolve(source, file));
  assert.equal(bytes.byteLength, expected.bytes); assert.equal(hash(bytes), expected.sha256);
  await writeFile(resolve(target, file), bytes);
}
await writeFile(resolve(target, 'manifest.json'), manifestBytes);
for (const layer of [...visuals.layers, visuals.noData]) {
  const bytes = await readFile(resolve(target, layer.file));
  assert.equal(hash(bytes), layer.sha256, `Corrupt web asset ${layer.file}`);
  assert.equal(layer.sourceSha256, manifest.outputs.find(x => x.path.endsWith('/' + layer.sourceFile))?.sha256);
}
const demo = JSON.parse(await readFile('data/routes/jezero-hirise-v1/route-a.json', 'utf8'));
assert.equal(demo.dataset.manifestSha256, hash(manifestBytes));
await writeFile(resolve(target, 'demo-query.json'), JSON.stringify({ start: demo.start, goal: demo.goal,
  datasetId: manifest.dataset_id, manifestSha256: hash(manifestBytes),
  method: 'Team-selected endpoints from the independently validated route demo; runtime routes are computed again' }, null, 2) + '\n');
await copyFile('dist/workers/routing.worker.js', 'public/workers/routing.worker.js');
const scienceRoot = resolve('public/data/jezero-science-v1');
const science = JSON.parse(await readFile(resolve(scienceRoot, 'manifest.json'), 'utf8'));
assert.equal(science.topographyManifestSha256, hash(manifestBytes), 'Science belongs to another topographic grid');
assert.equal(science.crsProj, manifest.local_crs_proj);
assert.equal(science.geologyAffectsRouting, false);
for (const entry of science.files) {
  const bytes = await readFile(resolve(scienceRoot, entry.file));
  assert.equal(bytes.byteLength, entry.bytes); assert.equal(hash(bytes), entry.sha256, `Corrupt science asset ${entry.file}`);
}
console.log('Verified and synchronized web visuals, untouched routing binaries and existing worker.');
