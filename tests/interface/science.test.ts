import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadLocalGrid } from '../../scripts/routing/local-data.js';
import { planRoute } from '../../lib/routing/engine.js';
import { auditRoute } from '../../scripts/routing/independent-audit.js';
import { validateScience } from '../../lib/science/model.js';
import type { ScienceData } from '../../lib/science/model.js';
import type { RoutingGrid } from '../../lib/routing/types.js';
import { englishScienceText } from '../../lib/map/display-copy.js';
let data: ScienceData, grid: RoutingGrid;
const json = async (name: string) => JSON.parse(await readFile(`public/data/jezero-science-v1/${name}`, 'utf8'));
beforeAll(async () => {
  grid = (await loadLocalGrid()).grid;
  const bytes = await readFile('public/data/jezero-science-v1/manifest.json');
  data = { manifest: JSON.parse(bytes.toString()), manifestSha256: createHash('sha256').update(bytes).digest('hex'), geology: await json('geology.json'), objectives: (await json('objectives.json')).objectives, photos: (await json('photos.json')).photos };
});
it('accepts the versioned real science package and all five published units', () => {
  expect(() => validateScience(data, grid)).not.toThrow();
  expect(new Set(data.geology.features.map(x => x.properties.symbol))).toEqual(new Set(['NHjf2', 'Nue', 'Nle', 'Aeb', 'Njf']));
  expect(data.geology.registration.documentedOffsetMeters).toEqual([100, 200]);
  const original = JSON.stringify(data);
  for (const text of [data.geology.registration.warningEs,
    ...data.objectives.flatMap(o => [o.designation, o.scientificObjective, ...o.sources.map(s => s.title)]),
    ...data.photos.flatMap(p => [p.locationMeaningEs, p.uncertainty.noteEs])]) {
    expect(englishScienceText(text)).not.toBe(text);
    expect(englishScienceText(text)).not.toMatch(/[áéíóúñ]|\b(?:del|las|los|una|por|para)\b/i);
  }
  expect(JSON.stringify(data)).toBe(original);
});
it('rejects scientific metadata on a different Mars grid or CRS', () => {
  for (const manifest of [{ ...data.manifest, crsProj: '+proj=longlat +datum=WGS84' }, { ...data.manifest, topographyManifestSha256: 'bad' }]) expect(() => validateScience({ ...data, manifest }, grid)).toThrow();
});
it('rejects invalid coordinates or fabricated unit associations', () => {
  const first = data.objectives[0]!;
  for (const point of [{ ...first, xy: [999999, 999999] as [number, number] }, { ...first, unitSymbol: 'fictional' }, { ...first, longitudeEastDeg: 0 }]) expect(() => validateScience({ ...data, objectives: [point] }, grid)).toThrow();
});
it('rejects a photo with a different rover motion counter or sol', () => {
  for (const photo of [{ ...data.photos[0]!, rmc: '99_1' }, { ...data.photos[0]!, sol: 999 }]) expect(() => validateScience({ ...data, photos: [photo] }, grid)).toThrow();
});
it('routes both modes to all three real team objectives with independent edge audits', () => {
  for (const objective of data.objectives) for (const lambda of [0, 4]) {
    const r = planRoute(grid, { col: 59, row: 302 }, objective.cell, { mode: lambda ? 'slope-penalty' : 'distance', lambda, maxSlopeDeg: 15 });
    expect(r.status).toBe('success'); if (r.status === 'success') expect(auditRoute(grid, r).passed).toBe(true);
  }
});
it('verifies the scientific asset hashes without changing original routing inputs', async () => {
  for (const entry of data.manifest.files) {
    const bytes = await readFile(`public/data/jezero-science-v1/${entry.file}`);
    expect(bytes.length).toBe(entry.bytes); expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
  }
  const prepared = await readFile('data/processed/jezero-hirise-v1/manifest.json');
  expect(createHash('sha256').update(prepared).digest('hex')).toBe(data.manifest.topographyManifestSha256);
});
