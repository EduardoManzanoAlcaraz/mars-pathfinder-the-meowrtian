import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadLocalGrid } from '../../scripts/routing/local-data.js';
import { planRoute } from '../../lib/routing/engine.js';
import { cellCenter, cellOf } from '../../lib/routing/grid.js';
import { elevationProfile, makeRouteExport, marsLonLat, routeCoordinates, selectEndpoint, validateCatalog } from '../../lib/map/model.js';
import type { RoutingGrid, RouteSuccess } from '../../lib/routing/types.js';
import type { VisualCatalog } from '../../lib/map/model.js';
let grid: RoutingGrid, catalog: VisualCatalog, route: RouteSuccess;
beforeAll(async () => {
  grid = (await loadLocalGrid()).grid;
  catalog = JSON.parse(await readFile('public/data/jezero-hirise-v1/visuals.json', 'utf8'));
  const result = planRoute(grid, { col: 59, row: 302 }, { col: 334, row: 53 }, { mode: 'slope-penalty', lambda: 4 });
  if (result.status !== 'success') throw new Error('Real example failed'); route = result;
});
describe('web coordinates on the actual Mars grid', () => {
  it('maps clicks to the declared north-first cell and exposes centre adjustment', () => {
    const center = cellCenter(grid, route.start);
    const selection = selectEndpoint(grid, { x: center.x + 2, y: center.y - 3 }, 15);
    expect(selection.error).toBe(null); expect(selection.endpoint?.cell).toEqual(route.start);
    expect(selection.endpoint?.center).toEqual(center); expect(selection.endpoint?.snapMeters).toBeCloseTo(Math.sqrt(13), 10);
  });
  it('rejects unknown cells, over-limit cells and outside coordinates without a replacement', () => {
    const unknown = grid.valid.findIndex(v => v === 0);
    const steep = grid.slope.findIndex((v, i) => grid.valid[i] === 1 && v > 15);
    for (const xy of [cellCenter(grid, cellOf(grid, unknown)), cellCenter(grid, cellOf(grid, steep)), { x: -1969, y: 1094000 }]) {
      const result = selectEndpoint(grid, xy, 15); expect(result.endpoint).toBe(null); expect(result.error).toBeTruthy();
    }
  });
  it('uses the spherical Mars eqc inverse, not a terrestrial projection', () => {
    expect(marsLonLat(grid, { x: 0, y: 0 })).toEqual({ longitudeEastDeg: 77.435, latitudeNorthDeg: 0 });
    const point = cellCenter(grid, route.start), geo = marsLonLat(grid, point);
    expect((geo.longitudeEastDeg - 77.435) * Math.PI / 180 * 3396190 * Math.cos(18.45 * Math.PI / 180)).toBeCloseTo(point.x, 7);
    expect(geo.latitudeNorthDeg * Math.PI / 180 * 3396190).toBeCloseTo(point.y, 7);
    expect(geo.latitudeNorthDeg).toBeGreaterThan(18.4); expect(geo.latitudeNorthDeg).toBeLessThan(18.5);
  });
  it('draws every original route cell centre in order without smoothing', () => {
    const points = routeCoordinates(grid, route); expect(points.length).toBe(route.cells.length);
    points.forEach((point, i) => { const cell = cellCenter(grid, cellOf(grid, route.cells[i]!)); expect(point).toEqual([cell.x, cell.y, grid.elevation[route.cells[i]!]!]); });
  });
  it('labels the elevation profile with real horizontal length and DEM heights', () => {
    const points = elevationProfile(grid, route);
    expect(points[0]!.distanceMeters).toBe(0); expect(points.at(-1)!.distanceMeters).toBeCloseTo(route.metrics.horizontalMeters, 9);
    expect(points.at(-1)!.elevationMeters - points[0]!.elevationMeters).toBe(route.metrics.netElevationMeters);
  });
  it('exports actual metrics, full local geometry, parameters and source identity', () => {
    const origin = selectEndpoint(grid, cellCenter(grid, route.start), 15).endpoint!;
    const goal = selectEndpoint(grid, cellCenter(grid, route.goal), 15).endpoint!;
    const json = makeRouteExport(grid, route, origin, goal, 'b');
    expect(json.metrics).toEqual(route.metrics); expect(json.parameters.lambda).toBe(4);
    expect(json.dataset.manifestSha256).toBe(catalog.preparedManifestSha256);
    expect(json.coordinates).toEqual(routeCoordinates(grid, route)); expect(json.coordinateSystem.body).toBe('Mars');
    expect(json.selectedOrigin.col).toBe(59); expect(json.selectedDestination.row).toBe(53);
  });
});
describe('optimized visual assets', () => {
  it('shares actual bounds and grid registration across all four display layers', () => {
    expect(() => validateCatalog(catalog, grid)).not.toThrow();
    expect(catalog.layers.map(x => x.id)).toEqual(['ortho', 'hillshade', 'elevation', 'slope']);
    expect(catalog.extent).toEqual([-1968, 1091838, 1968, 1095398]);
    for (const layer of catalog.layers) { expect(layer.width).toBe(984); expect(layer.height).toBe(890); expect(layer.displayResolutionM).toBe(4); }
    expect(catalog.noData.extent).toEqual([-1968, 1091838, 1972, 1095398]);
    // Last partially covered 10 m column stays blocked; it is never stretched to the 2 m crop.
    for (let row = 0; row < grid.height; row++) expect(grid.valid[row * grid.width + grid.width - 1]).toBe(0);
  });
  it('rejects mismatched data versions, display bounds and routing masks', () => {
    for (const bad of [ { ...catalog, datasetId: 'other' }, { ...catalog, crsProj: '+proj=longlat +datum=WGS84' }, { ...catalog, layers: catalog.layers.map(x => ({ ...x, extent: [0, 0, 100, 100] as [number, number, number, number] })) }, { ...catalog, noData: { ...catalog.noData, width: 393 } } ]) expect(() => validateCatalog(bad, grid)).toThrow();
  });
  it('verifies the actual display image hashes and copied scientific binaries', async () => {
    for (const layer of [...catalog.layers, catalog.noData]) {
      const bytes = await readFile('public/data/jezero-hirise-v1/' + layer.file);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(layer.sha256);
    }
    for (const file of ['manifest.json', 'routing_elevation.f32', 'routing_slope_max.f32', 'routing_valid.u8']) {
      expect(await readFile('public/data/jezero-hirise-v1/' + file)).toEqual(await readFile('data/processed/jezero-hirise-v1/' + file));
    }
  });
});
