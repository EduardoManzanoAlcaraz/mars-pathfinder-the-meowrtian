// Read-only checks of the built demo and recorded successful runs. Does not run tests.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
async function readLog(path) {
  const bytes = await readFile(path);
  // Windows PowerShell redirection writes UTF-16LE with a BOM by default.
  return bytes[0] === 255 && bytes[1] === 254 ? bytes.toString('utf16le').slice(1) : bytes.toString('utf8');
}
const routing = await readJson('docs/routing-validation/vitest.json');
const ui = await readJson('docs/interface-validation/vitest.json');
for (const [report, minimum] of [[routing, 37], [ui, 17]]) {
  assert.equal(report.success, true); assert.ok(report.numPassedTests >= minimum);
  assert.equal(report.numFailedTests, 0); assert.equal(report.numFailedTestSuites, 0);
}
const pytest = await readFile('docs/interface-validation/pytest.xml', 'utf8');
assert.match(pytest, /tests="16"/); assert.match(pytest, /failures="0"/); assert.match(pytest, /errors="0"/);
assert.match(await readLog('docs/interface-validation/build.log'), /Compiled successfully/);
assert.match(await readLog('docs/interface-validation/build.log'), /Static/);
const manifest = await readFile('data/processed/jezero-hirise-v1/manifest.json');
const visuals = await readJson('public/data/jezero-hirise-v1/visuals.json');
assert.equal(digest(manifest), visuals.preparedManifestSha256);
for (const file of ['manifest.json', 'routing_elevation.f32', 'routing_slope_max.f32', 'routing_valid.u8']) {
  const source = await readFile(`data/processed/jezero-hirise-v1/${file}`);
  for (const root of ['public', 'out']) assert.deepEqual(await readFile(`${root}/data/jezero-hirise-v1/${file}`), source);
}
for (const layer of [...visuals.layers, visuals.noData]) {
  for (const root of ['public', 'out']) assert.equal(digest(await readFile(`${root}/data/jezero-hirise-v1/${layer.file}`)), layer.sha256);
}
assert.deepEqual(await readFile('out/workers/routing.worker.js'), await readFile('dist/workers/routing.worker.js'));
const browser = await readJson('docs/interface-validation/browser.json');
assert.equal(browser.manifestSha256, digest(manifest));
assert.ok(browser.routes.a.audit.passed && browser.routes.b.audit.passed);
assert.ok(browser.alignment.every(x => x.errorPixels < 1.1));
assert.ok(browser.responsiveness.activeFrames > 0);
assert.equal(browser.uiCancellation.closedBeforeRecalculation, 2);
assert.ok(browser.mobile.noHorizontalOverflow && browser.noRoute.explicitNoRouteState && browser.corruptResponse.rejectedBeforeMapCreation);
for (const file of ['README.md', 'PLAN.md', 'docs/VALIDACION_INTERFAZ.md']) {
  const doc = await readFile(file, 'utf8');
  for (const [, link] of doc.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(link)) continue;
    assert.ok(existsSync(resolve(dirname(file), link)), `Broken document link in ${file}: ${link}`);
  }
}
async function size(path) {
  let bytes = 0, files = 0;
  for (const item of await readdir(path)) {
    const name = resolve(path, item), info = await stat(name);
    if (info.isDirectory()) { const nested = await size(name); bytes += nested.bytes; files += nested.files; }
    else { bytes += info.size; files++; }
  }
  return { bytes, files };
}
const report = { checkedAtUtc: new Date().toISOString(), purpose: 'Validate actual build and recorded evidence; not a replacement for executing tests',
  vitestRoutingPassed: routing.numPassedTests, vitestInterfacePassed: ui.numPassedTests, pytestPassed: 16,
  manifestSha256: digest(manifest), staticScientificCopiesIdentical: true, staticVisualHashesVerified: true,
  existingWorkerBundleIdentical: true, staticOutput: await size('out'), documentLinksExist: true,
  downloadedRoutesIndependentlyAudited: true, measuredMarkerAlignmentPassed: true,
  browserCancellationAndReplacementPassed: true, productionDeploymentPerformed: false };
await writeFile('docs/interface-validation/final-checks.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
