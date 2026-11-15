import assert from 'node:assert/strict';
import { readdir, readFile, lstat, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, relative, extname, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Review the actual static payload. Never print potential secret values.
const output = 'docs/deployment-validation';
await mkdir(output, { recursive: true });
const security = JSON.parse(await readFile(`${output}/antivirus.json`, 'utf8'));
assert.equal(security.reviewRequired, false);
for (const file of ['README.md', 'docs/DESPLIEGUE_FINAL.md']) {
  const text = await readFile(file, 'utf8');
  for (const [, link] of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (!/^https?:/.test(link)) await access(resolve(dirname(file), link));
  }
}
const allowed = new Set(['.html', '.txt', '.js', '.css', '.json', '.f32', '.u8', '.webp', '.wld', '.jpg', '.svg', '.woff2']);
const textual = new Set(['.html', '.txt', '.js', '.css', '.json', '.svg', '.wld']);
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['openai-token', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ['netlify-token', /\bnfp_[A-Za-z0-9_-]{30,}/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\b/],
  ['literal-credential', /(?:api[_-]?key|auth[_-]?token|client[_-]?secret|password)\s*[=:]\s*["'][A-Za-z0-9_+/=-]{20,}["']/i],
  ['absolute-private-windows-path', /[A-Z]:[\\/]+Users[\\/]+/i],
];
const findings = [], entries = [];
async function walk(folder) {
  for (const name of (await readdir(folder)).sort()) {
    const path = resolve(folder, name), info = await lstat(path), rel = relative(resolve('out'), path).replaceAll('\\', '/');
    assert.ok(!info.isSymbolicLink(), `Unexpected symlink: ${rel}`);
    assert.ok(!/(?:^|\/)(?:\.env(?:\..*)?|\.git|\.netlify|\.cache|node_modules|raw|private|credentials)(?:\/|$)/i.test(rel), `Private path: ${rel}`);
    if (info.isDirectory()) { await walk(path); continue; }
    assert.ok(allowed.has(extname(path)), `Unexpected public format: ${rel}`);
    assert.ok(info.size < 10_000_000, `Unexpected large public file: ${rel}`);
    const bytes = await readFile(path);
    if (textual.has(extname(path))) {
      const text = bytes.toString('utf8');
      for (const [rule, expression] of rules) if (expression.test(text)) findings.push({ path: rel, rule });
    }
    entries.push({ path: rel, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}
await walk('out');
// Every intended public asset must be present byte-for-byte, including scientific binaries.
async function comparePublic(folder) {
  for (const name of await readdir(folder)) {
    const path = resolve(folder, name), info = await lstat(path);
    if (info.isDirectory()) { await comparePublic(path); continue; }
    const rel = relative(resolve('public'), path).replaceAll('\\', '/');
    assert.deepEqual(await readFile(resolve('out', rel)), await readFile(path), `Public asset changed: ${rel}`);
  }
}
await comparePublic('public');
const packages = JSON.parse(await readFile('package.json', 'utf8'));
let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* No Git repository; do not invent a revision. */ }
let release = null;
try {
  release = JSON.parse(await readFile('out/release.json', 'utf8'));
  assert.match(release.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(release.runtimeInputsSha256, /^[a-f0-9]{64}$/);
  commit = release.sourceCommit;
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const report = {
  checkedAtUtc: new Date().toISOString(), version: packages.version, commit,
  revisionNote: release ? 'Built from the verified source checkout; out/release.json identifies the source commit and runtime-input hashes.' : commit ? 'Existing Git revision; see payload fingerprint for actual deployed bytes.' : 'Workspace has no Git repository. Payload fingerprint identifies the actual release.',
  runtimeInputsSha256: release?.runtimeInputsSha256 ?? null,
  node: process.version, next: JSON.parse(await readFile('node_modules/next/package.json', 'utf8')).version,
  build: { command: 'npm run build', publish: 'out', mode: 'Next.js output: export', serverRequired: false },
  scanScope: 'Every file in out/. Known credential signatures, private paths, explicit format/size allowlist and byte equality with public/. This is not a universal proof of absence of secrets.',
  findings, publicAssetsUnchanged: true, rawOriginalsPublished: false,
  files: entries.length, totalBytes: entries.reduce((sum, f) => sum + f.bytes, 0),
  payloadSha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
  lockSha256: createHash('sha256').update(await readFile('package-lock.json')).digest('hex'), entries,
};
await writeFile(`${output}/preflight.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, entries: undefined }, null, 2));
assert.deepEqual(findings, [], 'Review potential secrets/private information before publishing');
