import type { Cell, RoutingGrid } from '../../lib/routing/types.js';
/** O(V²) reference, no production heap, edge, heuristic or metric imports. */
export function dijkstraReference(g: RoutingGrid, start: Cell, goal: Cell, lambda: number, maxSlope = 15, reference = 15): number {
  const size = g.width * g.height, distance = new Array<number>(size).fill(Infinity), done = new Array<boolean>(size).fill(false);
  const valid = (id: number) => id >= 0 && id < size && g.valid[id] === 1 && Number.isFinite(g.elevation[id]) && g.elevation[id] !== g.nodata && Number.isFinite(g.slope[id]) && g.slope[id]! >= 0 && g.slope[id]! <= maxSlope && g.slope[id]! < 90 && g.slope[id] !== g.nodata;
  const source = start.row * g.width + start.col, target = goal.row * g.width + goal.col;
  if (!valid(source) || !valid(target)) return Infinity;
  distance[source] = 0;
  while (true) {
    let u = -1, best = Infinity;
    for (let i = 0; i < size; i++) if (!done[i] && distance[i]! < best) { best = distance[i]!; u = i; }
    if (u < 0 || u === target) return u === target ? distance[target]! : Infinity;
    done[u] = true;
    const row = Math.floor(u / g.width), col = u % g.width;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const r = row + dy, c = col + dx;
      if (r < 0 || c < 0 || r >= g.height || c >= g.width) continue;
      const v = r * g.width + c;
      if (!valid(v) || done[v]) continue;
      if (dx && dy && (!valid(row * g.width + c) || !valid(r * g.width + col))) continue;
      const length = Math.sqrt((dx * g.transform[1]) ** 2 + (dy * g.transform[5]) ** 2);
      const angle = Math.atan(Math.abs(g.elevation[v]! - g.elevation[u]!) / length) * 180 / Math.PI;
      const theta = Math.max(angle, g.slope[u]!, g.slope[v]!);
      if (theta > maxSlope) continue;
      const candidate = best + length * (1 + lambda * (theta / reference) ** 2);
      if (candidate < distance[v]!) distance[v] = candidate;
    }
  }
}
