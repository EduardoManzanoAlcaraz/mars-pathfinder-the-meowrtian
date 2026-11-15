import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { resolve } from 'node:path';
import { cellCenter, cellOf } from '../../lib/routing/grid.js';
import { evaluateEdge, normalizeOptions, planRoute } from '../../lib/routing/engine.js';
import type { Cell, RouteOptions, RouteSuccess, RoutingGrid } from '../../lib/routing/types.js';
import { loadLocalGrid } from './local-data.js';
import { auditRoute } from './independent-audit.js';

const out = resolve('data/routes/jezero-hirise-v1'), evidence = resolve('docs/routing-validation');
await mkdir(out, { recursive: true }); await mkdir(evidence, { recursive: true });
const writeJson = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
const { grid, manifestBytes } = await loadLocalGrid();
if (grid.width !== 394 || grid.height !== 356) throw new Error('Demo expects the manifest-confirmed 394 x 356 grid; do not silently substitute data');

// Four-connected component under ALL edge constraints, not just a slope mask.
function selectEndpoints(grid: RoutingGrid) {
  const p = normalizeOptions({ mode: 'distance', maxSlopeDeg: 15 });
  const n = grid.valid.length, visited = new Uint8Array(n), queue = new Int32Array(n);
  let largest = new Int32Array(0), components = 0;
  for (let origin = 0; origin < n; origin++) {
    if (visited[origin]) continue;
    if (grid.valid[origin] !== 1 || !Number.isFinite(grid.elevation[origin]) || grid.elevation[origin] === grid.nodata || !Number.isFinite(grid.slope[origin]) || grid.slope[origin]! < 0 || grid.slope[origin]! > 15) { visited[origin] = 1; continue; }
    let head = 0, tail = 1; queue[0] = origin; visited[origin] = 1; components++;
    while (head < tail) {
      const current = queue[head++]!, col = current % grid.width, row = Math.floor(current / grid.width);
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nc = col + dc, nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= grid.width || nr >= grid.height) continue;
        const next = nr * grid.width + nc;
        if (!visited[next] && evaluateEdge(grid, current, next, p)) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    if (tail > largest.length) largest = queue.slice(0, tail);
  }
  if (largest.length < 2) throw new Error('No useful connected component');
  function nearest(fx: number, fy: number): Cell {
    let best = -1, score = Infinity;
    for (const id of largest) {
      const cell = cellOf(grid, id), d = (cell.col - fx * (grid.width - 1)) ** 2 + (cell.row - fy * (grid.height - 1)) ** 2;
      if (d < score || (d === score && id < best)) { score = d; best = id; }
    }
    return cellOf(grid, best);
  }
  return { start: nearest(0.15, 0.85), goal: nearest(0.85, 0.15), largestComponentCells: largest.length, components,
    method: 'Nearest cells in the largest four-connected component to fixed normalized targets (0.15,0.85) and (0.85,0.15), with centre-segment constraints; no scientific POI or NASA base implied' };
}
const selection = selectEndpoints(grid);
const cases = [{ name: 'route-a', options: { mode: 'distance', lambda: 0, maxSlopeDeg: 15, thetaRefDeg: 15 } },
  { name: 'route-b', options: { mode: 'slope-penalty', lambda: 4, maxSlopeDeg: 15, thetaRefDeg: 15 } }] satisfies { name: string; options: RouteOptions }[];
function point(cell: Cell) {
  const xy = cellCenter(grid, cell);
  // Inverse of the exact local equirectangular projection in the manifest.
  const parameter = (name: string) => {
    const match = grid.dataset.crsProj.match(new RegExp(`(?:^|\\s)\\+${name}=([^\\s]+)`));
    if (!match || !Number.isFinite(Number(match[1]))) throw new Error(`Missing projection parameter ${name}`);
    return Number(match[1]);
  };
  const radius = parameter('R'), degrees = 180 / Math.PI;
  return { ...cell, ...xy, elevationMeters: grid.elevation[cell.row * grid.width + cell.col]!,
    longitudeEastDeg: parameter('lon_0') + xy.x / (radius * Math.cos(parameter('lat_ts') / degrees)) * degrees,
    planetocentricLatitudeDeg: parameter('lat_0') + xy.y / radius * degrees };
}
const results: Record<string, RouteSuccess> = {}, audits: Record<string, unknown> = {};
for (const item of cases) {
  const result = planRoute(grid, selection.start, selection.goal, item.options);
  if (result.status !== 'success') throw new Error(`${item.name}: ${result.status} ${result.reason}`);
  results[item.name] = result;
  const audit = auditRoute(grid, result); audits[item.name] = audit;
  if (!audit.passed) throw new Error(`Independent edge audit failed: ${JSON.stringify(audit.violations)}`);
  await writeJson(resolve(out, item.name + '.json'), { schema: 'mars-pathfinder-local-route-v1', ...result,
    coordinateSystem: { body: 'Mars', crsWkt: grid.dataset.crsWkt, crsProj: grid.dataset.crsProj, units: 'metres', affine: grid.transform,
      geometryConvention: 'Ordered cell centres in local projected x/y; custom JSON, not RFC7946 GeoJSON' },
    selectedOrigin: point(selection.start), selectedDestination: point(selection.goal),
    coordinates: result.cells.map(id => { const xy = cellCenter(grid, cellOf(grid, id)); return [xy.x, xy.y, grid.elevation[id]!]; }),
    pathSha256: createHash('sha256').update(JSON.stringify(result.cells)).digest('hex'),
    independentAudit: audit, interpretation: 'Optimized discrete topographic model; no physical EVA safety certification' });
}
const timings: Record<string, number[]> = Object.fromEntries(cases.map(x => [x.name, []]));
for (let repeat = 0; repeat < 10; repeat++) for (const item of cases) {
  const result = planRoute(grid, selection.start, selection.goal, item.options);
  if (result.status !== 'success') throw new Error('Benchmark route failed');
  if (JSON.stringify(result.cells) !== JSON.stringify(results[item.name]!.cells)) throw new Error('Path changed between repeated runs');
  timings[item.name]!.push(result.computeTimeMs);
}
const performanceReport = Object.fromEntries(cases.map(item => {
  const measured = timings[item.name]!, sorted = [...measured].sort((a, b) => a - b), initial = results[item.name]!.computeTimeMs;
  return [item.name, { firstRunMs: initial, repeatTimesMs: measured, repeatCount: measured.length,
    medianMs: (sorted[4]! + sorted[5]!) / 2, p95NearestRankMs: sorted[Math.ceil(0.95 * sorted.length) - 1]!,
    maxIncludingFirstMs: Math.max(initial, ...measured), targetMs: 2000, allUnderTarget: Math.max(initial, ...measured) < 2000 }];
}));
const currentManifest = await readFile(resolve('data/processed/jezero-hirise-v1/manifest.json'));
if (createHash('sha256').update(currentManifest).digest('hex') !== grid.dataset.manifestSha256) throw new Error('Prepared manifest changed during route calculation');
const reloaded = await loadLocalGrid();
const dataUnchanged = Object.keys(grid.dataset.assets).every(key => reloaded.grid.dataset.assets[key] === grid.dataset.assets[key]);
if (!dataUnchanged) throw new Error('Prepared arrays changed');
const report = { executedAtUtc: new Date().toISOString(), engineVersion: results['route-a']!.engineVersion,
  environment: { node: process.version, platform: process.platform, architecture: process.arch, osRelease: os.release(), cpuModel: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem() },
  dataset: grid.dataset, grid: { width: grid.width, height: grid.height, transform: grid.transform, manifestBytes: manifestBytes.byteLength },
  selection, selectedOrigin: point(selection.start), selectedDestination: point(selection.goal),
  routes: Object.fromEntries(cases.map(x => { const r = results[x.name]!; return [x.name, { file: `data/routes/jezero-hirise-v1/${x.name}.json`, parameters: r.parameters, metrics: r.metrics, expandedCells: r.expandedCells, discoveredCells: r.discoveredCells, peakOpenCells: r.peakOpenCells, pathCells: r.cells.length, computeTimeMs: r.computeTimeMs }]; })),
  edgeAudits: audits, performance: performanceReport, sourceDataUnchanged: dataUnchanged,
  benchmarkScope: 'Synchronous TypeScript core, including arrays/search/reconstruction/metrics; excludes file loading and worker transport. Same pair, first recorded A* run plus ten repetitions per mode. Endpoint component selection runs beforehand, so this is not a full cold-start benchmark.' };
await writeJson(resolve(evidence, 'jezero-results.json'), report);
console.log(JSON.stringify(report, null, 2));
