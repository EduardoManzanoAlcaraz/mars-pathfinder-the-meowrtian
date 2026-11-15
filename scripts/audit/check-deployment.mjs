import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const dir = 'docs/deployment-validation';
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const preflight = await json(`${dir}/preflight.json`);
const browser = await json(`${dir}/browser-audit.json`);
const deploy = await json(`${dir}/deploy.json`);
const site = await json(`${dir}/site.json`);
const state = await json(`${dir}/deploy-state.json`);
const http = await json(`${dir}/http-inspection.json`);
assert.equal(site.id, deploy.site_id); assert.equal(site.ssoLogin, false);
assert.equal(site.passwordProtected, false); assert.equal(site.publishedDeployId, deploy.deploy_id);
assert.equal(site.brandingSettings.built_with_badge_enabled, false);
assert.equal(state.state, 'ready'); assert.equal(state.context, 'production');
assert.equal(state.errorMessage, null); assert.deepEqual(state.requiredFunctions, []);
assert.equal(http.httpRedirect.status, 301);
assert.equal(http.httpRedirect.location, deploy.url + '/'); assert.equal(http.missingFileStatus, 404);
const routing = await json('docs/routing-validation/vitest.json');
const ui = await json('docs/interface-validation/vitest.json');
for (const [report, minimum] of [[routing, 37], [ui, 35]]) {
  assert.equal(report.success, true); assert.ok(report.numPassedTests >= minimum);
  assert.equal(report.numPassedTests, report.numTotalTests);
  assert.equal(report.numFailedTests, 0); assert.equal(report.numPendingTests, 0);
}
const python = await readFile(`${dir}/pytest.xml`, 'utf8');
assert.match(python, /tests="22"/); assert.match(python, /failures="0"/); assert.match(python, /errors="0"/);
assert.deepEqual(preflight.findings, []); assert.equal(browser.allPassed, true);
assert.equal(browser.scenarios.length, 2);
assert.match(browser.source, /public HTTPS deployment/);
assert.ok(browser.source.includes(new URL(deploy.url).origin));
assert.equal(browser.staticInventory.files, preflight.files);
for (const entry of preflight.entries) {
  const remote = browser.staticInventory.entries.find(x => x.path === entry.path);
  assert.equal(remote?.sha256, entry.sha256, `Public content differs: ${entry.path}`);
  assert.equal(remote?.canonicalSha256, entry.sha256);
  assert.ok(['byte-exact', 'exact-netlify-hosting-comment-only'].includes(remote.match));
  if (!entry.path.endsWith('.html')) assert.equal(remote.servedSha256, entry.sha256);
  assert.equal(remote.status, 200);
  if (entry.path.endsWith('.js')) assert.match(remote.contentType, /javascript/);
  if (entry.path.endsWith('manifest.json')) assert.match(remote.cacheControl, /must-revalidate/);
  if (entry.path.startsWith('_next/static/')) assert.match(remote.cacheControl, /immutable/);
  const bytes = await readFile(`out/${entry.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
}
const scenarios = browser.scenarios.map(s => {
  assert.equal(s.fullFlowPassed, true); assert.equal(s.coldBrowserCache, true);
  assert.equal(s.guidedMission?.passed, true, 'The current release must pass Start Mission, not just the legacy manual flow');
  assert.deepEqual(s.errors, []); assert.deepEqual(s.externalRequests, []);
  assert.ok(s.routes.a.audit.passed && s.routes.b.audit.passed);
  assert.equal(s.routes.a.parameters.lambda, 0); assert.equal(s.routes.b.parameters.lambda, 4);
  assert.ok(s.routes.a.computeTimeMs < 2000 && s.routes.b.computeTimeMs < 2000);
  return { viewport: `${s.config.width}x${s.config.height}`, mapAndScienceReadyMs: s.mapAndScienceReadyMs,
    bothRoutesUiMs: s.bothRoutesUiMs, initialBodyBytes: s.initialBodyBytes,
    routeAComputeTimeMs: s.routes.a.computeTimeMs, routeBComputeTimeMs: s.routes.b.computeTimeMs,
    routeA: s.routes.a.metrics, routeB: s.routes.b.metrics };
});
const result = { checkedAtUtc: new Date().toISOString(), publicUrl: deploy.url, deployId: deploy.deploy_id,
  version: preflight.version, commit: preflight.commit, payloadSha256: preflight.payloadSha256,
  vitestPassed: routing.numPassedTests + ui.numPassedTests, pytestPassed: Number(python.match(/tests="(\d+)"/)[1]), publicAssetsHashVerified: preflight.files, publicBytes: preflight.totalBytes,
  filesByteExact: browser.staticInventory.entries.filter(x => x.match === 'byte-exact').length,
  htmlWithExactNonExecutableNetlifyComment: browser.staticInventory.entries.filter(x => x.match === 'exact-netlify-hosting-comment-only').length,
  netlifyProductionReady: true, passwordOrSsoRequired: false, optionalBadgeDisabled: true, httpRedirectsToHttps: true,
  privateBrowserSessionsWithoutCredentialsPassed: 2, noRuntimeExternalDependencies: true, scenarios,
  decision: 'Public educational demo verified over HTTPS. No operational EVA safety certification.' };
await writeFile(`${dir}/final-checks.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
