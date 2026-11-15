// Official USGS inputs only. Reuses existing files; streams downloads and verifies sizes/hashes.
import { mkdir, readFile, writeFile, stat, statfs, rename } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
const raw = resolve('data/raw/usgs-sim3464'), evidence = resolve('docs/science-validation');
await mkdir(raw, { recursive: true }); await mkdir(evidence, { recursive: true });
const disk = await statfs(raw, { bigint: true }), free = disk.bavail * disk.bsize;
console.log(`Free bytes before downloading: ${free}`);
if (free < 2_000_000_000n) throw new Error('At least 2 GB free required for ZIP and extracted vector database.');
const names = ['sim3464_readme.txt', 'sim3464_metadata.txt', 'sim3464.pdf', 'sim3464_database.zip'];
const reportPath = resolve(evidence, 'usgs-downloads.json');
let previous = []; try { previous = JSON.parse(await readFile(reportPath, 'utf8')).files; } catch {}
const files = [];
for (const name of names) {
  const url = `https://pubs.usgs.gov/sim/3464/${name}`, path = resolve(raw, name);
  let exists = false; try { await stat(path); exists = true; } catch {}
  let headers = null;
  if (!exists) {
    const r = await fetch(url, { signal: AbortSignal.timeout(900000), headers: { 'Accept-Encoding': 'identity' } });
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    const expected = Number(r.headers.get('content-length'));
    if (name.endsWith('.zip') && expected !== 349336873) throw new Error(`Changed ZIP size: ${expected}`);
    let received = 0;
    const guard = new Transform({ transform(chunk, _, done) { received += chunk.length; done(expected > 0 && received > expected ? new Error('Response too long') : null, chunk); } });
    console.log(`Downloading ${name}, expected ${expected} bytes`);
    await pipeline(Readable.fromWeb(r.body), guard, createWriteStream(path + '.part'));
    if (expected > 0 && received !== expected) throw new Error('Truncated response');
    await rename(path + '.part', path);
    headers = Object.fromEntries(['content-length', 'last-modified', 'etag', 'content-type'].map(k => [k, r.headers.get(k)]));
  }
  const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk);
  const sha256 = hash.digest('hex'), size = (await stat(path)).size, old = previous.find(x => x.name === name);
  if (old && old.sha256 !== sha256) throw new Error(`Previously downloaded ${name} changed`);
  files.push({ name, path: `data/raw/usgs-sim3464/${name}`, url, bytes: size, sha256, action: exists ? 'reused' : 'downloaded', responseHeaders: headers ?? old?.responseHeaders, checkedAtUtc: new Date().toISOString() });
  await writeFile(reportPath, JSON.stringify({ freeBytesBefore: String(free), files, integrity: 'Exact HTTP size and local SHA-256; ZIP CRC additionally checked by preparation script. No publisher full-file checksum claimed.' }, null, 2) + '\n');
  console.log(`${name}: ${size} bytes, SHA256 ${sha256}`);
}
