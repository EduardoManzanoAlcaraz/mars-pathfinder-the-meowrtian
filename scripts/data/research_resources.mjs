import { mkdir, writeFile } from 'node:fs/promises';
const dir = 'docs/science-validation', raw = 'data/raw/resource-discovery'; await mkdir(dir, { recursive: true }); await mkdir(raw, { recursive: true });
const pages = [
  ['mars-trek', 'https://trek.nasa.gov/mars/'],
  ['perseverance-raw', 'https://mars.nasa.gov/mars2020/multimedia/raw-images/'],
  ['perseverance-map', 'https://mars.nasa.gov/maps/location/?mission=M20'],
];
const report = await Promise.all(pages.map(async ([name, url]) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
  const body = await r.text(); await writeFile(`${raw}/${name}.html`, body);
  const scripts = [...body.matchAll(/<script[^>]*src=["']([^"']+)/g)].map(x => new URL(x[1], r.url).href);
  const result = { name, url, finalUrl: r.url, status: r.status, bytes: Buffer.byteLength(body), scripts, atUtc: new Date().toISOString() };
  console.log(JSON.stringify(result)); return result;
}));
await writeFile(`${dir}/resource-pages.json`, JSON.stringify(report, null, 2) + '\n');
