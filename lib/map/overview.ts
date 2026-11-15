import type { MapExtent } from './model.js';
import type { RoutingGrid } from '../routing/types.js';
export const OVERVIEW_SHA256 = 'f20ada191ed59a7f053d74fb022e98f317df8de5a530dc49d32d76593c40f8bb';
export type ContextGeometry = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
export interface RegionalContext {
  schema: string; datasetId: string; topographyManifestSha256: string; crsProj: string;
  extent: MapExtent; studyExtent: MapExtent;
  features: { id: number; properties: { symbol: string; name: string }; geometry: ContextGeometry }[];
  roverRecords: { imageId: string; xy: [number, number]; sol: number; rmc: string }[];
  source: { title: string; url: string; layer: string; zipSha256: string };
  derivation: { maximumMeasuredHausdorffM: number; geologyRegistrationOffsetM: number[]; routingUse: boolean; warning: string };
}
export function validateOverview(context: RegionalContext, grid: RoutingGrid, studyExtent: MapExtent) {
  if (context.schema !== 'mars-pathfinder-regional-context-v1' || context.topographyManifestSha256 !== grid.dataset.manifestSha256 || context.crsProj !== grid.dataset.crsProj || context.derivation.routingUse !== false) throw new Error('Regional context is incompatible with the prepared Mars grid.');
  if (context.studyExtent.some((v, i) => v !== studyExtent[i]) || context.extent.length !== 4 || !context.extent.every(Number.isFinite) || context.extent[0] >= context.extent[2] || context.extent[1] >= context.extent[3]) throw new Error('Regional context has invalid extents.');
  if (context.extent[0] > studyExtent[0] || context.extent[1] > studyExtent[1] || context.extent[2] < studyExtent[2] || context.extent[3] < studyExtent[3]) throw new Error('Regional context does not contain the study area.');
}
export async function loadOverview(grid: RoutingGrid, studyExtent: MapExtent, signal: AbortSignal): Promise<RegionalContext> {
  const response = await fetch('/data/jezero-overview-v1/context.json', { signal });
  if (!response.ok) throw new Error(`Regional context HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
  if (hash !== OVERVIEW_SHA256) throw new Error('Regional context integrity check failed.');
  const context = JSON.parse(new TextDecoder().decode(bytes)) as RegionalContext;
  validateOverview(context, grid, studyExtent); return context;
}
/** Uniform metric scale, y inverted once: north is up, no Earth transform. */
export function contextFrame(extent: MapExtent, width = 280, height = 190) {
  const scale = Math.min((width - 24) / (extent[2] - extent[0]), (height - 24) / (extent[3] - extent[1]));
  const left = (width - (extent[2] - extent[0]) * scale) / 2, top = (height - (extent[3] - extent[1]) * scale) / 2;
  const point = (xy: number[]) => [left + (xy[0]! - extent[0]) * scale, top + (extent[3] - xy[1]!) * scale] as const;
  const rect = (bounds: MapExtent) => {
    const a = point([Math.max(extent[0], bounds[0]), Math.min(extent[3], bounds[3])]);
    const b = point([Math.min(extent[2], bounds[2]), Math.max(extent[1], bounds[1])]);
    return { x: a[0], y: a[1], width: Math.max(0, b[0] - a[0]), height: Math.max(0, b[1] - a[1]) };
  };
  const path = (geometry: ContextGeometry) => {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return polygons.map(polygon => polygon.map(ring => ring.map((xy, i) => { const p = point(xy); return `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`; }).join(' ') + 'Z').join(' ')).join(' ');
  };
  return { point, rect, path, scale };
}
