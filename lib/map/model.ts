import { cellCenter, cellOf, projectedToCell, indexOf, cellBlockReason } from '../routing/grid.js';
import type { Cell, RoutingGrid, RouteSuccess, XY } from '../routing/types.js';

export type LayerId = 'ortho' | 'hillshade' | 'elevation' | 'slope';
export type MapExtent = [number, number, number, number];
export interface VisualLayer {
  id: LayerId; title: string; file: string; width: number; height: number;
  extent: MapExtent; displayResolutionM: number; sourceResolutionM: number;
  sourceFile: string; sourceSha256: string; sha256: string; bytes: number;
  provenance: string; method: string; colors: string[] | null;
  minimum: number | null; maximum: number | null; units: string;
}
export interface VisualCatalog {
  schema: string; datasetId: string; preparedManifestSha256: string; crsProj: string;
  extent: MapExtent; credit: string;
  sourceProducts: { name: string; url: string; sha256: string }[];
  layers: VisualLayer[];
  noData: { file: string; width: number; height: number; extent: MapExtent; resolutionM: number; sha256: string; meaning: string };
}
export interface Endpoint { cell: Cell; clicked: XY; center: XY; snapMeters: number }
export const DATA_URL = '/data/jezero-hirise-v1/';
export const ROUTE_COLORS = { a: '#43e1ed', b: '#ffbf59' } as const;

export function selectEndpoint(grid: RoutingGrid, xy: XY, maxSlopeDeg: number): { endpoint: Endpoint; error: null } | { endpoint: null; error: string } {
  const cell = projectedToCell(grid, xy);
  if (!cell) return { endpoint: null, error: 'El punto está fuera de la región cartografiada. Selecciona otra posición.' };
  const id = indexOf(grid, cell), reason = cellBlockReason(grid, id, maxSlopeDeg);
  if (reason === 'no-data') return { endpoint: null, error: `La celda ${cell.col}, ${cell.row} no tiene datos válidos para planificar. No se ha desplazado el punto.` };
  if (reason) return { endpoint: null, error: `Pendiente de celda ${grid.slope[id]!.toFixed(1)}°, superior al límite de ${maxSlopeDeg}°. Selecciona otra celda.` };
  const center = cellCenter(grid, cell);
  return { endpoint: { cell, clicked: { ...xy }, center, snapMeters: Math.hypot(center.x - xy.x, center.y - xy.y) }, error: null };
}
/** Exact inverse of the declared Mars eqc projection, no Earth/WGS84 conversion. */
export function marsLonLat(grid: RoutingGrid, xy: XY): { longitudeEastDeg: number; latitudeNorthDeg: number } {
  const p = (name: string) => {
    const match = grid.dataset.crsProj.match(new RegExp(`(?:^|\\s)\\+${name}=([^\\s]+)`));
    if (!match || !Number.isFinite(Number(match[1]))) throw new Error(`Missing Mars CRS parameter ${name}`);
    return Number(match[1]);
  };
  const degrees = 180 / Math.PI, r = p('R');
  return { longitudeEastDeg: p('lon_0') + xy.x * degrees / (r * Math.cos(p('lat_ts') / degrees)), latitudeNorthDeg: p('lat_0') + xy.y * degrees / r };
}
export function routeCoordinates(grid: RoutingGrid, route: RouteSuccess): [number, number, number][] {
  return route.cells.map(id => { const p = cellCenter(grid, cellOf(grid, id)); return [p.x, p.y, grid.elevation[id]!]; });
}
export function elevationProfile(grid: RoutingGrid, route: RouteSuccess) {
  const coordinates = routeCoordinates(grid, route);
  let distance = 0;
  return coordinates.map((point, index) => {
    if (index) { const previous = coordinates[index - 1]!; distance += Math.hypot(point[0] - previous[0], point[1] - previous[1]); }
    return { distanceMeters: distance, elevationMeters: point[2] };
  });
}
export function makeRouteExport(grid: RoutingGrid, route: RouteSuccess, origin: Endpoint, destination: Endpoint, name: 'a' | 'b') {
  return { schema: 'mars-pathfinder-local-route-v1', exportedAtUtc: new Date().toISOString(), routeName: name, ...route,
    coordinateSystem: { body: 'Mars', crsWkt: grid.dataset.crsWkt, crsProj: grid.dataset.crsProj, units: 'metres', affine: grid.transform, geometryConvention: 'Ordered cell centres in local projected x/y; custom JSON, not RFC7946 GeoJSON' },
    selectedOrigin: { ...origin.cell, ...origin.center, ...marsLonLat(grid, origin.center), elevationMeters: grid.elevation[indexOf(grid, origin.cell)]!, clickedXY: origin.clicked, snapMeters: origin.snapMeters },
    selectedDestination: { ...destination.cell, ...destination.center, ...marsLonLat(grid, destination.center), elevationMeters: grid.elevation[indexOf(grid, destination.cell)]!, clickedXY: destination.clicked, snapMeters: destination.snapMeters },
    coordinates: routeCoordinates(grid, route), interpretation: 'Optimized discrete topographic model; no physical EVA safety certification' };
}
export function validateCatalog(catalog: VisualCatalog, grid: RoutingGrid): void {
  if (catalog.datasetId !== grid.dataset.id || catalog.preparedManifestSha256 !== grid.dataset.manifestSha256 || catalog.crsProj !== grid.dataset.crsProj) throw new Error('Las capas visuales y el motor pertenecen a versiones de datos diferentes.');
  for (const layer of catalog.layers) {
    if (layer.extent.some((value, i) => value !== catalog.extent[i]) || (layer.extent[2] - layer.extent[0]) / layer.width !== layer.displayResolutionM || (layer.extent[3] - layer.extent[1]) / layer.height !== layer.displayResolutionM) throw new Error(`Georreferenciación visual inconsistente: ${layer.id}`);
  }
  const expected = [grid.transform[0], grid.transform[3] + grid.height * grid.transform[5], grid.transform[0] + grid.width * grid.transform[1], grid.transform[3]];
  if (catalog.noData.width !== grid.width || catalog.noData.height !== grid.height || catalog.noData.extent.some((x, i) => x !== expected[i])) throw new Error('La máscara visual no coincide con la malla de rutas.');
}
