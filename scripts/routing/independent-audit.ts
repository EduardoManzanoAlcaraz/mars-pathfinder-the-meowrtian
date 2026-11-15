/** Independent verification: deliberately does NOT import engine edge/metric code. */
import type { RouteSuccess, RoutingGrid } from '../../lib/routing/types.js';

export function auditRoute(grid: RoutingGrid, route: RouteSuccess) {
  const p = route.parameters, errors: string[] = [], n = grid.width * grid.height;
  const usable = (id: number) => Number.isInteger(id) && id >= 0 && id < n && grid.valid[id] === 1 && Number.isFinite(grid.elevation[id]) && grid.elevation[id] !== grid.nodata && Number.isFinite(grid.slope[id]) && grid.slope[id]! >= 0 && grid.slope[id]! < 90 && grid.slope[id] !== grid.nodata && grid.slope[id]! <= p.maxSlopeDeg;
  const cells = route.cells;
  if (!cells.length || cells[0] !== route.start.row * grid.width + route.start.col || cells.at(-1) !== route.goal.row * grid.width + route.goal.col) errors.push('Endpoints differ from query');
  let horizontal = 0, terrain = 0, up = 0, down = 0, cost = 0, maxSlope = grid.slope[cells[0]!] ?? NaN;
  const exposure = new Array<number>(p.exposureBinsDeg.length - 1).fill(0);
  for (let k = 0; k < cells.length; k++) {
    const id = cells[k]!;
    if (!usable(id)) errors.push(`Invalid route cell ${k}`);
    if (k === 0) continue;
    const before = cells[k - 1]!, ac = before % grid.width, ar = Math.floor(before / grid.width), bc = id % grid.width, br = Math.floor(id / grid.width);
    const dx = bc - ac, dy = br - ar;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy)) errors.push(`Not adjacent at edge ${k - 1}`);
    if (dx && dy && (!usable(ar * grid.width + bc) || !usable(br * grid.width + ac))) errors.push(`Blocked corner at edge ${k - 1}`);
    const d = Math.sqrt((dx * grid.transform[1]) ** 2 + (dy * grid.transform[5]) ** 2), dz = grid.elevation[id]! - grid.elevation[before]!;
    const angle = Math.atan(Math.abs(dz) / d) * 180 / Math.PI;
    const theta = Math.max(angle, grid.slope[id]!, grid.slope[before]!);
    if (theta > p.maxSlopeDeg) errors.push(`Slope limit at edge ${k - 1}`);
    horizontal += d; terrain += Math.sqrt(d * d + dz * dz); up += Math.max(0, dz); down += Math.max(0, -dz);
    cost += d * (1 + p.lambda * (theta / p.thetaRefDeg) ** 2); maxSlope = Math.max(maxSlope, theta);
    const bin = p.exposureBinsDeg.findIndex((x, i) => i < exposure.length && theta >= x && theta < p.exposureBinsDeg[i + 1]!);
    if (bin < 0) errors.push(`No exposure interval at edge ${k - 1}`); else exposure[bin]! += d;
  }
  const independentMetrics = { horizontalMeters: horizontal, terrainMeters: terrain, ascentMeters: up, descentMeters: down,
    netElevationMeters: grid.elevation[cells.at(-1)!]! - grid.elevation[cells[0]!]!, totalCost: cost, maxSlopeDeg: maxSlope };
  const differences = Object.fromEntries(Object.entries(independentMetrics).map(([key, value]) => [key, Math.abs(value - route.metrics[key as keyof typeof independentMetrics])]));
  if (Object.entries(differences).some(([key, value]) => value > 1e-8 * Math.max(1, Math.abs(independentMetrics[key as keyof typeof independentMetrics])))) errors.push('Reported metrics differ from independent recomputation');
  if (route.metrics.exposure.length !== exposure.length || exposure.some((x, i) => Math.abs(x - route.metrics.exposure[i]!.horizontalMeters) > 1e-7)) errors.push('Exposure distances differ');
  return { passed: errors.length === 0, checkedCells: cells.length, checkedEdges: Math.max(0, cells.length - 1), violations: errors, independentMetrics, absoluteDifferences: differences };
}
