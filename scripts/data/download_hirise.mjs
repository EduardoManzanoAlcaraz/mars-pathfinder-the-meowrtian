// Official reduced-resolution ortho only. Streaming downloads; originals stay ignored.
import { mkdir, stat, readFile, writeFile, rename, statfs } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const raw = new URL('data/raw/hirise-pds/', root);
const reports = new URL('docs/validation/', root);
const base = 'https://www.uahirise.org/PDS/DTM/ESP/ORB_045900_045999/ESP_045994_1985_ESP_046060_1985/';
const files = [
  ['DTEEC_045994_1985_046060_1985_U01.IMG', 380814764, 'hirise-pds-dem'],
  ['ESP_046060_1985_RED_C_01_ORTHO.JP2', 33534820, 'hirise-pds-ortho'],
  ['ESP_046060_1985_RED_C_01_ORTHO.LBL', 5432, 'hirise-pds-ortho-label'],
];
await mkdir(raw, { recursive: true });
await mkdir(reports, { recursive: true });
const space = await statfs(raw, { bigint: true });
const free = space.bavail * space.bsize;
if (free < 3n * 1024n ** 3n) throw new Error('At least 3 GiB of free space is required');
const research = JSON.parse(await readFile(new URL('docs/research/evidence/http-checks.json', root), 'utf8'));
let previous = [];
try { previous = JSON.parse(await readFile(new URL('download-manifest.json', raw), 'utf8')).files; } catch (e) { if (e.code !== 'ENOENT') throw e; }
async function sha256(path, firstBytes) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path, firstBytes ? { start: 0, end: firstBytes - 1 } : {})) h.update(chunk);
  return h.digest('hex');
}
async function obtain([name, expectedBytes, researchId]) {
  const url = base + name, path = new URL(name, raw);
  let existing;
  try { existing = await stat(path); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  let action = 'reused-existing';
  if (existing && existing.size !== expectedBytes) throw new Error(`Existing ${name} has unexpected size; not overwritten`);
  let responseHeaders = {};
  if (!existing) {
    action = 'downloaded';
    const partial = new URL(name + '.part', raw);
    const response = await fetch(url, { signal: AbortSignal.timeout(900000), headers: { 'Accept-Encoding': 'identity' } });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length'));
    if (declared !== expectedBytes) { await response.body.cancel(); throw new Error(`${name}: unexpected Content-Length ${declared}`); }
    let received = 0;
    const guard = new Transform({ transform(chunk, encoding, callback) {
      received += chunk.length;
      callback(received > expectedBytes ? new Error('Response exceeds expected file size') : null, chunk);
    } });
    console.log(`Downloading ${name} (${expectedBytes} bytes)`);
    await pipeline(Readable.fromWeb(response.body), guard, createWriteStream(partial));
    if (received !== expectedBytes) throw new Error(`${name}: truncated response (${received} bytes)`);
    responseHeaders = Object.fromEntries(['etag', 'last-modified', 'content-type', 'content-length'].map(k => [k, response.headers.get(k)]));
    await rename(partial, path);
  }
  const digest = await sha256(path);
  const previousFile = previous.find(f => f.name === name);
  if (previousFile && previousFile.sha256 !== digest) throw new Error(`${name}: local SHA-256 differs from previous download manifest`);
  const old = research.find(x => x.id === researchId);
  const sampleHash = await sha256(path, old.sampleBytes);
  if (sampleHash !== old.sampleSha256) throw new Error(`${name}: prefix differs from the officially fetched research sample`);
  const result = { name, path: `data/raw/hirise-pds/${name}`, url, bytes: expectedBytes, sha256: digest, researchPrefixBytes: old.sampleBytes, researchPrefixMatches: true, action, responseHeaders: action === 'downloaded' ? responseHeaders : previousFile?.responseHeaders, downloadedAtUtc: action === 'downloaded' ? new Date().toISOString() : previousFile?.downloadedAtUtc ?? null };
  console.log(JSON.stringify({ name, action, bytes: expectedBytes, sha256: digest, prefixMatches: true }));
  return result;
}
// Keep a successfully downloaded item even if the next request fails.
const results = [];
for (const f of files) {
  results.push(await obtain(f));
  await writeFile(new URL('download-manifest.json', raw), JSON.stringify({ files: results }, null, 2) + '\n');
}
const manifest = { checkedAtUtc: new Date().toISOString(), freeBytesBeforeDownload: String(free), integrity: 'Exact expected size, local SHA-256, matching research prefix. No publisher full-file checksum was supplied in the product labels.', files: results };
await writeFile(new URL('downloads.json', reports), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Manifest: ${fileURLToPath(new URL('downloads.json', reports))}`);
