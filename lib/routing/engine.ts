import { BinaryMinHeap } from './heap.js';
import { assertGrid, cellBlockReason, cellOf, inBounds, indexOf } from './grid.js';
import type { Cell, Edge, Parameters, RouteMetrics, RouteOptions, RouteResult, RoutingGrid } from './types.js';

export const ENGINE_VERSION = '1.0.0';
const DEGREES = 180 / Math.PI;
const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;

export function normalizeOptions(options: RouteOptions): Parameters {
  if (!options || !['distance', 'slope-penalty'].includes(options.mode)) throw new Error('Unknown routing mode');
  const lambda = options.lambda ?? (options.mode === 'distance' ? 0 : 4);
  const maxSlopeDeg = options.maxSlopeDeg ?? 15, thetaRefDeg = options.thetaRefDeg ?? 15;
  const bins = [...(options.exposureBinsDeg ?? [0, 5, 10, 15, 90])];
  if (!Number.isFinite(lambda) || lambda < 0 || (options.mode === 'distance' && lambda !== 0)) throw new Error('Distance mode requires lambda=0; penalty lambda must be finite and nonnegative');
  if (!Number.isFinite(maxSlopeDeg) || maxSlopeDeg < 0 || maxSlopeDeg >= 90 || !Number.isFinite(thetaRefDeg) || thetaRefDeg <= 0 || thetaRefDeg >= 90) throw new Error('Invalid slope angles in degrees');
  if (bins.length < 2 || bins[0] !== 0 || bins.at(-1) !== 90 || bins.some((x, i) => !Number.isFinite(x) || (i > 0 && x <= bins[i - 1]!))) throw new Error('Exposure bins must increase strictly from 0 to 90 degrees');
  return { mode: options.mode, lambda, maxSlopeDeg, thetaRefDeg, exposureBinsDeg: bins };
}

/** A diagonal needs both orthogonal side cells valid; its direct segment is tested. */
export function evaluateEdge(grid: RoutingGrid, from: number, to: number, p: Parameters): Edge | null {
  if (cellBlockReason(grid, from, p.maxSlopeDeg) || cellBlockReason(grid, to, p.maxSlopeDeg)) return null;
  const a = cellOf(grid, from), b = cellOf(grid, to), dc = b.col - a.col, dr = b.row - a.row;
  if (Math.abs(dc) > 1 || Math.abs(dr) > 1 || (dc === 0 && dr === 0)) return null;
  if (dc && dr && (cellBlockReason(grid, a.row * grid.width + b.col, p.maxSlopeDeg) || cellBlockReason(grid, b.row * grid.width + a.col, p.maxSlopeDeg))) return null;
  const horizontalMeters = Math.hypot(dc * grid.transform[1], dr * grid.transform[5]);
  const deltaElevationMeters = grid.elevation[to]! - grid.elevation[from]!;
  const segmentSlopeDeg = Math.atan2(Math.abs(deltaElevationMeters), horizontalMeters) * DEGREES;
  const effectiveSlopeDeg = Math.max(segmentSlopeDeg, grid.slope[from]!, grid.slope[to]!);
  if (effectiveSlopeDeg > p.maxSlopeDeg) return null;
  const cost = horizontalMeters * (1 + p.lambda * (effectiveSlopeDeg / p.thetaRefDeg) ** 2);
  return { horizontalMeters, deltaElevationMeters, segmentSlopeDeg, effectiveSlopeDeg, cost };
}

export function computeMetrics(grid: RoutingGrid, cells: readonly number[], p: Parameters): RouteMetrics {
  if (!cells.length) throw new Error('Cannot measure an empty path');
  const exposure = p.exposureBinsDeg.slice(0, -1).map((lowerInclusiveDeg, i) => ({ lowerInclusiveDeg, upperExclusiveDeg: p.exposureBinsDeg[i + 1]!, horizontalMeters: 0, fractionOfHorizontalLength: 0 }));
  let horizontalMeters = 0, terrainMeters = 0, ascentMeters = 0, descentMeters = 0, totalCost = 0;
  let maxSlopeDeg = grid.slope[cells[0]!]!;
  if (cellBlockReason(grid, cells[0]!, p.maxSlopeDeg)) throw new Error('Invalid starting cell in path');
  for (let i = 1; i < cells.length; i++) {
    const edge = evaluateEdge(grid, cells[i - 1]!, cells[i]!, p);
    if (!edge) throw new Error(`Invalid route edge ${i - 1}`);
    horizontalMeters += edge.horizontalMeters;
    terrainMeters += Math.hypot(edge.horizontalMeters, edge.deltaElevationMeters);
    ascentMeters += Math.max(0, edge.deltaElevationMeters);
    descentMeters += Math.max(0, -edge.deltaElevationMeters);
    totalCost += edge.cost; maxSlopeDeg = Math.max(maxSlopeDeg, edge.effectiveSlopeDeg);
    const bin = exposure.find(x => edge.effectiveSlopeDeg >= x.lowerInclusiveDeg && edge.effectiveSlopeDeg < x.upperExclusiveDeg)!;
    bin.horizontalMeters += edge.horizontalMeters;
  }
  for (const bin of exposure) bin.fractionOfHorizontalLength = horizontalMeters ? bin.horizontalMeters / horizontalMeters : 0;
  return { horizontalMeters, terrainMeters, ascentMeters, descentMeters,
    netElevationMeters: grid.elevation[cells.at(-1)!]! - grid.elevation[cells[0]!]!, maxSlopeDeg, totalCost, exposure };
}

/** Pure synchronous core. Cancellation is provided by terminating its worker. */
export function planRoute(grid: RoutingGrid, start: Cell, goal: Cell, options: RouteOptions): RouteResult {
  const began = performance.now();
  let parameters: Parameters | null = null;
  let expandedCells = 0, discoveredCells = 0, peakOpenCells = 0;
  const base = () => ({ engineVersion: ENGINE_VERSION, dataset: grid.dataset, parameters, start, goal,
    computeTimeMs: performance.now() - began, expandedCells, discoveredCells, peakOpenCells });
  try { assertGrid(grid); } catch (error) { return { ...base(), status: 'invalid-grid', reason: String(error) }; }
  try {
    parameters = normalizeOptions(options);
    const worstCost = Math.hypot(grid.transform[1], grid.transform[5]) * (1 + parameters.lambda * (parameters.maxSlopeDeg / parameters.thetaRefDeg) ** 2) * grid.valid.length;
    if (!Number.isFinite(worstCost)) throw new Error('Cost would overflow');
  } catch (error) { return { ...base(), status: 'invalid-parameters', reason: String(error) }; }
  for (const [which, cell] of [['start', start], ['goal', goal]] as const) {
    const reason = !inBounds(grid, cell) ? 'out-of-bounds-or-noninteger' : cellBlockReason(grid, indexOf(grid, cell), parameters.maxSlopeDeg);
    if (reason) return { ...base(), status: which === 'start' ? 'invalid-start' : 'invalid-goal', reason };
  }
  const n = grid.width * grid.height, source = indexOf(grid, start), target = indexOf(grid, goal);
  const g = new Float64Array(n).fill(Infinity), parent = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const open = new BinaryMinHeap(n);
  const heuristic = (col: number, row: number) => Math.hypot((col - goal.col) * grid.transform[1], (row - goal.row) * grid.transform[5]);
  g[source] = 0; open.set(source, heuristic(start.col, start.row), heuristic(start.col, start.row));
  discoveredCells = 1; peakOpenCells = 1;
  while (open.size) {
    const current = open.pop()!;
    closed[current] = 1; expandedCells++;
    if (current === target) {
      const cells: number[] = [];
      for (let at = target; at !== -1; at = parent[at]!) cells.push(at);
      cells.reverse();
      const metrics = computeMetrics(grid, cells, parameters);
      return { ...base(), status: 'success', parameters, cells, metrics };
    }
    const row = Math.floor(current / grid.width), col = current % grid.width;
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = col + dc, nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= grid.width || nr >= grid.height) continue;
      const next = nr * grid.width + nc;
      if (closed[next]) continue;
      const edge = evaluateEdge(grid, current, next, parameters);
      if (!edge) continue;
      const candidate = g[current]! + edge.cost;
      if (candidate < g[next]!) {
        if (g[next] === Infinity) discoveredCells++;
        g[next] = candidate; parent[next] = current;
        const h = heuristic(nc, nr);
        open.set(next, candidate + h, h);
      }
    }
    peakOpenCells = Math.max(peakOpenCells, open.size);
  }
  return { ...base(), status: 'no-route', reason: 'No connected path under the configured topographic constraints' };
}
