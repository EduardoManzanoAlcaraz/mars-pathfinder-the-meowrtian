// Publish only the existing authorized static site; never creates/configures sites.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const run = promisify(execFile), siteId = '89d24aa6-4300-4b08-afcc-84f51da7f164';
const cli = path.resolve('.tools/netlify-cli/node_modules/netlify-cli/bin/run.js');
const mode = process.argv[2]; assert.ok(['preview', 'production'].includes(mode));
async function call(args) {
  const result = await run(process.execPath, [cli, ...args], { cwd: process.cwd(), env: { ...process.env, NETLIFY_TELEMETRY_DISABLED: '1' }, maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(result.stdout);
}
const api = (method, data) => call(['api', method, '--data', JSON.stringify(data)]);
const before = await api('getSite', { siteId });
assert.equal(before.id, siteId); assert.equal(before.name, 'mars-pathfinder-the-meowrtian');
assert.equal(Boolean(before.build_settings?.repo_url), false, 'Inspect any newly connected Git CD before manual publication');
const preflight = JSON.parse(await fs.readFile('docs/deployment-validation/preflight.json', 'utf8'));
assert.deepEqual(preflight.findings, []);
const marker = JSON.parse(await fs.readFile('out/release.json', 'utf8'));
assert.equal(marker.sourceCommit, preflight.commit);
for (const f of preflight.entries) assert.equal(createHash('sha256').update(await fs.readFile(path.join('out', f.path))).digest('hex'), f.sha256);
const previous = JSON.parse(await fs.readFile('docs/jury-release-20261115/recovery.json', 'utf8'));
assert.equal(before.published_deploy.id, previous.previousDeploy, 'Production changed since the preserved baseline');
if (mode === 'production') {
  const preview = JSON.parse(await fs.readFile('docs/jury-release-20261115/preview/browser-audit.json', 'utf8'));
  assert.equal(preview.allPassed, true); assert.equal(preview.scenarios.length, 2);
  assert.ok(preview.scenarios.every(x => x.fullFlowPassed && x.guidedMission?.passed));
  assert.equal(preview.staticInventory.files, preflight.files);
  for (const f of preflight.entries) assert.equal(preview.staticInventory.entries.find(x => x.path === f.path)?.canonicalSha256, f.sha256);
}
const args = ['deploy', '--no-build', '--dir', path.resolve('out'), '--site', siteId,
  '--message', `Mars Pathfinder jury release; source ${marker.sourceCommit}; ${mode}`, '--json'];
if (mode === 'production') args.push('--prod'); else args.push('--alias', 'jury-20261115-review');
const response = await call(args);
const id = response.deploy_id; assert.ok(id);
const deploy = await api('getDeploy', { deployId: id });
assert.equal(deploy.site_id, siteId); assert.equal(deploy.state, 'ready'); assert.equal(deploy.error_message, null);
assert.deepEqual(deploy.required_functions ?? [], []);
const site = await api('getSite', { siteId });
if (mode === 'preview') assert.equal(site.published_deploy.id, previous.previousDeploy);
else assert.equal(site.published_deploy.id, id);
const result = { recordedAtUtc: new Date().toISOString(), mode, site_id: siteId, deploy_id: id,
  url: site.ssl_url, deploy_url: deploy.deploy_ssl_url, previewAlias: mode === 'preview' ? response.deploy_url : null,
  state: deploy.state, context: deploy.context, sourceCommit: marker.sourceCommit,
  payloadSha256: preflight.payloadSha256, runtimeInputsSha256: marker.runtimeInputsSha256,
  previousProductionDeployId: previous.previousDeploy, currentProductionDeployId: site.published_deploy.id };
const dir = `docs/jury-release-20261115/${mode}`; await fs.mkdir(dir, { recursive: true });
await fs.writeFile(`${dir}/deploy.json`, JSON.stringify(result, null, 2) + '\n');
if (mode === 'production') await fs.writeFile('docs/deployment-validation/deploy.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
