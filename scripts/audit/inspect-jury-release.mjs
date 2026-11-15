import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { startStaticServer } from '../web/serve-static.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function logText(name) {
  const bytes = await readFile(`.cache/jury-improvement/${name}`);
  return bytes.toString(bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
}
const routingLog = await logText('routing-tests.log'), interfaceLog = await logText('interface-tests-final.log'), pythonLog = await logText('pytest-final.log');
const routingMatch = routingLog.match(/Tests\s+(\d+) passed \((\d+)\)/), interfaceMatch = interfaceLog.match(/Tests\s+(\d+) passed \((\d+)\)/), pythonMatch = pythonLog.match(/(\d+) passed in/);
assert.ok(routingMatch && interfaceMatch && pythonMatch, 'Real passing test logs required');
assert.equal(routingMatch[1], routingMatch[2]); assert.equal(interfaceMatch[1], interfaceMatch[2]);
for (const name of ['package.json', 'package-lock.json']) assert.deepEqual(await readFile(name), await readFile(`.cache/github-publication/repository/${name}`), 'Do not change dependencies for this presentation phase');
const protectedFiles = JSON.parse(await readFile('.cache/jury-improvement/protected-before.json', 'utf8'));
for (const file of protectedFiles) assert.equal(hash(await readFile(file.path)), file.sha256, `Protected scientific/engine bytes changed: ${file.path}`);
const inventory = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(file); else { const bytes = await readFile(file); inventory.push({ path: file.slice(4), bytes: bytes.length, sha256: hash(bytes) }); }
  }
}
await walk('out');
assert.ok(!inventory.some(f => /\.(img|jp2|tif|zip|pem|key)$/i.test(f.path) || /(^|\/)(\.env|raw|node_modules|\.netlify)(\/|$)/.test(f.path)));
const server = await startStaticServer({ port: 0 }); const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (const file of inventory) {
    const response = await fetch(`${base}/${file.path.split('/').map(encodeURIComponent).join('/')}`);
    assert.equal(response.status, 200, `Missing exported asset: ${file.path}`);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), file.sha256, `Served bytes differ: ${file.path}`);
  }
} finally { const closed = new Promise(done => server.close(done)); server.closeAllConnections(); await closed; }
const browser = JSON.parse(await readFile('docs/interface-validation/browser.json', 'utf8'));
assert.equal(browser.juryMissions.length, 2);
for (const run of browser.juryMissions) {
  assert.equal(run.routeExports.length, 2);
  assert.ok(run.routeExports.every(x => x.audit.passed));
}
const result = { checkedAtUtc: new Date().toISOString(), deployment: 'local static build only; no Netlify mutation',
  protectedFilesCompared: protectedFiles.length, originalScientificAssetsAndEngineUnchanged: true,
  originalCodeLicense: 'Apache-2.0', noNewDependencies: true,
  staticFiles: inventory.length, staticBytes: inventory.reduce((sum, f) => sum + f.bytes, 0), allStaticFilesHttp200AndSha256Equal: true,
  newContextBytes: (await readFile('public/data/jezero-overview-v1/context.json')).length,
  testCounts: { routingWorkers: Number(routingMatch[1]), interfaceScience: Number(interfaceMatch[1]), pythonFullData: Number(pythonMatch[1]) },
  browserMissions: browser.juryMissions, inventory };
for (const name of ['routing-tests.log', 'interface-tests-final.log', 'pytest-final.log', 'typecheck-final.log', 'build-final.log']) {
  let contents = await logText(name);
  for (const prefix of [process.cwd(), process.cwd().replaceAll('\\', '/')]) contents = contents.split(prefix).join('<workspace>');
  await writeFile(`docs/jury-improvement/${name.replace(/\.log$/, '.txt')}`, contents);
}
await writeFile('docs/jury-improvement/final-checks.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, inventory: `${inventory.length} hashes saved in report`, browserMissions: result.browserMissions.map(x => ({ viewport: x.viewport, readyMs: x.readyMs, demoRoundTripMs: x.demoRoundTripMs, computeTimeMs: x.computeTimeMs })) }, null, 2));
