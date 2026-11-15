import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('data/raw/resource-discovery', { recursive: true });
const items = [
  ['trek-run.js','https://trek.nasa.gov/mars/app/run.js?v=3.4.123-Mars'],
  ['rover-map-main.js','https://mars.nasa.gov/build/static/js/main.8434bd16.chunk.js'],
  ['raw-main.js','https://mars.nasa.gov/js/raw-images/m20/static/js/main.1a396d7e.chunk.js'],
];
for (const [name,url] of items) {
  const r = await fetch(url, {signal:AbortSignal.timeout(45000)}); const body=await r.text();
  await writeFile(`data/raw/resource-discovery/${name}`, body); console.log(JSON.stringify({name,url,status:r.status,bytes:body.length}));
}
