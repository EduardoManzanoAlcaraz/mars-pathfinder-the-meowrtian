// Final read-only verification of scientific inputs, exports and recorded checks.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

for (const file of ['README.md', 'PLAN.md', 'docs/VALIDACION_GEOESPACIAL.md', 'docs/VALIDACION_RUTAS.md']) {
  const content = await readFile(file, 'utf8');
  for (const link of content.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(link[1])) continue;
    assert.ok(existsSync(resolve(dirname(file), link[1])), `Missing local document target: ${file}: ${link[1]}`);
  }
}
const manifestPath = 'data/processed/jezero-hirise-v1/manifest.json';
const bytes = await readFile(manifestPath);
const manifest = JSON.parse(bytes);
const manifestSha256 = createHash('sha256').update(bytes).digest('hex');
for (const entry of [...manifest.input_files, ...manifest.outputs]) {
  const digest = createHash('sha256'); let size = 0;
  for await (const chunk of createReadStream(entry.path)) { digest.update(chunk); size += chunk.length; }
  assert.equal(size, entry.bytes, `Size changed: ${entry.path}`);
  assert.equal(digest.digest('hex'), entry.sha256, `Hash changed: ${entry.path}`);
}
for (const name of ['route-a', 'route-b']) {
  const route = JSON.parse(await readFile(`data/routes/jezero-hirise-v1/${name}.json`, 'utf8'));
  assert.equal(route.dataset.manifestSha256, manifestSha256);
  assert.equal(route.status, 'success'); assert.equal(route.independentAudit.passed, true);
}
const vitest = JSON.parse(await readFile('docs/routing-validation/vitest.json', 'utf8'));
assert.equal(vitest.numPassedTests, 37); assert.equal(vitest.numFailedTests, 0); assert.equal(vitest.numPendingTests, 0);
const pytest = await readFile('docs/routing-validation/pytest-regression.xml', 'utf8');
assert.match(pytest, /tests="16"/); assert.match(pytest, /failures="0"/); assert.match(pytest, /errors="0"/);
const reference = JSON.parse(await readFile('docs/routing-validation/independent-dijkstra.json', 'utf8'));
assert.ok(Object.values(reference.routes).every(x => x.passed && x.violations === 0 && x.cost_absolute_difference < 1e-6));
const browser = JSON.parse(await readFile('docs/routing-validation/browser-worker.json', 'utf8'));
assert.equal(browser.cancelBusy.browserObservedTerminatedWorkerClose, true);
assert.equal(browser.supersedeBusy.browserObservedTerminatedWorkerClose, true);
assert.ok(browser.realJezero.results.every(x => x.audit.passed));
const bundle = await readFile('dist/workers/routing.worker.js');
const report = { checkedAtUtc: new Date().toISOString(), originalNASAProductsHashVerified: manifest.input_files.length,
  preparedOutputsHashVerified: manifest.outputs.length, preparedManifestSha256: manifestSha256,
  originalAndPreparedDataUnchanged: true, documentLocalTargetsExist: true,
  recordedVitestPassed: 37, recordedPytestPassed: 16,
  independentDijkstraAndAllEdgeAuditsPassed: true, realBrowserTerminationAndReplacementPassed: true,
  browserWorkerBundleBytes: bundle.byteLength, browserWorkerBundleSha256: createHash('sha256').update(bundle).digest('hex') };
await writeFile('docs/routing-validation/final-checks.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
