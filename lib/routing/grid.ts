import type { Cell, RoutingGrid, XY } from './types.js';

export function assertGrid(grid: RoutingGrid): void {
  const n = grid.width * grid.height;
  if (!Number.isSafeInteger(grid.width) || !Number.isSafeInteger(grid.height) || grid.width < 1 || grid.height < 1 || !Number.isSafeInteger(n) || n >= 2 ** 31) throw new Error('Invalid grid dimensions');
  if (!(grid.elevation instanceof Float32Array) || !(grid.slope instanceof Float32Array) || !(grid.valid instanceof Uint8Array) || grid.elevation.length !== n || grid.slope.length !== n || grid.valid.length !== n) throw new Error('Array types or lengths differ from grid');
  const t = grid.transform;
  if (t.length !== 6 || !t.every(Number.isFinite) || t[1] <= 0 || t[5] >= 0 || t[2] !== 0 || t[4] !== 0 || !Number.isFinite(grid.nodata)) throw new Error('Expected north-up projected metre grid without rotation');
  if (!grid.dataset?.id || !grid.dataset.crsWkt || !grid.dataset.crsProj) throw new Error('Missing data version or Mars CRS');
}
export function inBounds(grid: RoutingGrid, cell: Cell): boolean {
  return !!cell && Number.isInteger(cell.col) && Number.isInteger(cell.row) && cell.col >= 0 && cell.row >= 0 && cell.col < grid.width && cell.row < grid.height;
}
export function indexOf(grid: RoutingGrid, cell: Cell): number { return cell.row * grid.width + cell.col; }
export function cellOf(grid: RoutingGrid, index: number): Cell { return { col: index % grid.width, row: Math.floor(index / grid.width) }; }
export function cellCenter(grid: RoutingGrid, cell: Cell): XY {
  if (!inBounds(grid, cell)) throw new Error('Cell outside grid');
  const t = grid.transform;
  return { x: t[0] + (cell.col + 0.5) * t[1], y: t[3] + (cell.row + 0.5) * t[5] };
}
/** No clamping: east/south outer boundaries are outside the half-open grid. */
export function projectedToCell(grid: RoutingGrid, xy: XY): Cell | null {
  if (!Number.isFinite(xy.x) || !Number.isFinite(xy.y)) return null;
  const cell = { col: Math.floor((xy.x - grid.transform[0]) / grid.transform[1]), row: Math.floor((xy.y - grid.transform[3]) / grid.transform[5]) };
  return inBounds(grid, cell) ? cell : null;
}
export function cellBlockReason(grid: RoutingGrid, index: number, maxSlopeDeg: number): string | null {
  const z = grid.elevation[index]!, s = grid.slope[index]!;
  if (index < 0 || index >= grid.valid.length || grid.valid[index] !== 1 || !Number.isFinite(z) || !Number.isFinite(s) || z === grid.nodata || s === grid.nodata || s < 0 || s >= 90) return 'no-data';
  return s > maxSlopeDeg ? 'cell-slope-limit' : null;
}
