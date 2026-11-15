import { beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadLocalGrid } from '../../scripts/routing/local-data.js';
import { planRoute } from '../../lib/routing/engine.js';
import { compareRoutes } from '../../lib/map/route-comparison.js';
import { contextFrame, OVERVIEW_SHA256, validateOverview } from '../../lib/map/overview.js';
import type { RegionalContext } from '../../lib/map/overview.js';
import type { RoutingGrid, RouteSuccess } from '../../lib/routing/types.js';
let grid: RoutingGrid, context: RegionalContext, a: RouteSuccess, b: RouteSuccess;
beforeAll(async () => {
  grid = (await loadLocalGrid()).grid;
  context = JSON.parse(await readFile('public/data/jezero-overview-v1/context.json', 'utf8'));
  const routeA = planRoute(grid, { col: 59, row: 302 }, { col: 334, row: 53 }, { mode: 'distance' });
  const routeB = planRoute(grid, { col: 59, row: 302 }, { col: 334, row: 53 }, { mode: 'slope-penalty', lambda: 4 });
  if (routeA.status !== 'success' || routeB.status !== 'success') throw new Error('Actual validated scenario failed');
  a = routeA; b = routeB;
});
it('binds regional context to the unchanged Mars CRS, real study extent and exact asset hash', async () => {
  expect(() => validateOverview(context, grid, [-1968, 1091838, 1968, 1095398])).not.toThrow();
  expect(createHash('sha256').update(await readFile('public/data/jezero-overview-v1/context.json')).digest('hex')).toBe(OVERVIEW_SHA256);
  expect(context.features).toHaveLength(37);
  expect(context.derivation.maximumMeasuredHausdorffM).toBeLessThanOrEqual(25.1);
  const photos = JSON.parse(await readFile('public/data/jezero-science-v1/photos.json', 'utf8')).photos;
  for (const p of context.roverRecords) {
    const source = photos.find((item: { imageId: string }) => item.imageId === p.imageId);
    expect(source).toBeDefined(); expect(p.xy).toEqual(source.xy); expect(p.rmc).toBe(source.rmc); expect(p.sol).toBe(source.sol);
  }
});
it('preserves north-up orientation and the same metric scale on both SVG axes', () => {
  const frame = contextFrame(context.extent), origin = frame.point([0, 1093000]);
  const east = frame.point([1000, 1093000]), north = frame.point([0, 1094000]);
  expect(east[0] - origin[0]).toBeCloseTo(origin[1] - north[1], 10);
  expect(north[1]).toBeLessThan(origin[1]);
  const box = frame.rect(context.studyExtent);
  expect(box.width / box.height).toBeCloseTo(3936 / 3560, 10);
  expect(box.x).toBeGreaterThan(0); expect(box.y).toBeGreaterThan(0);
  expect(box.x + box.width).toBeLessThan(280); expect(box.y + box.height).toBeLessThan(190);
});
it('rejects regional context with an Earth CRS, different area or navigation use', () => {
  for (const changed of [
    { ...context, crsProj: 'EPSG:4326' },
    { ...context, studyExtent: [0, 0, 1, 1] as RegionalContext['studyExtent'] },
    { ...context, derivation: { ...context.derivation, routingUse: true } },
  ]) expect(() => validateOverview(changed, grid, context.studyExtent)).toThrow();
});
it('describes measured real-route deltas with a model limitation', () => {
  const text = compareRoutes(a, b);
  expect(text).toContain(Math.abs(b.metrics.horizontalMeters - a.metrics.horizontalMeters).toFixed(2) + ' m');
  expect(text).toContain(Math.abs(b.metrics.maxSlopeDeg - a.metrics.maxSlopeDeg).toFixed(2) + ' °');
  expect(text).toContain('not a physical safety assessment');
});
it('does not invent an improvement when routes are equal or an ascent/slope is higher', () => {
  expect(compareRoutes(a, a)).toContain('equal in horizontal length');
  expect(compareRoutes(a, a)).toContain('the same cumulative ascent');
  // Report-only synthetic wording fixtures; these are never rendered as Mars observations.
  const changed = { ...a, metrics: { ...a.metrics, ascentMeters: a.metrics.ascentMeters + 2, maxSlopeDeg: a.metrics.maxSlopeDeg + 1 } };
  expect(compareRoutes(a, changed)).toContain('2.00 m more cumulative ascent');
  expect(compareRoutes(a, changed)).toContain('1.00 ° higher maximum modeled slope');
});
