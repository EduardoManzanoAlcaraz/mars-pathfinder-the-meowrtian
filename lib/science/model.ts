import { cellBlockReason, cellCenter, indexOf, projectedToCell } from '../routing/grid.js';
import type { Cell, RoutingGrid } from '../routing/types.js';
import { marsLonLat } from '../map/model.js';
import { sha256 } from '../routing/load-grid.js';

export const SCIENCE_URL = '/data/jezero-science-v1/';
export const UNIT_COLORS: Readonly<Record<string, string>> = { NHjf2: '#68b6df', Nle: '#ef9c80', Njf: '#c795ac', Nue: '#d4ab69', Aeb: '#e4cf79' };
export interface GeologyFeature {
  type: 'Feature'; id: number;
  properties: { unit: string; name: string; symbol: string; sourceFid: number; clippedAreaM2: number };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}
export interface Geology {
  schema: string; crsProj: string; topographyManifestSha256: string; extent: [number, number, number, number];
  source: { title: string; authors: string[]; year: number; publication: string; url: string; doi: string; scaleDenominator: number; zipSha256: string };
  registration: { documentedOffsetMeters: number[]; warningEs: string; navigationUse: string };
  features: GeologyFeature[];
}
export interface ScienceObjective {
  id: string; label: string; designation: string; xy: [number, number]; cell: Cell;
  longitudeEastDeg: number; latitudePlanetocentricDeg: number; elevationMeters: number; routingSlopeMaxDeg: number; routingMask: number;
  unitSymbol: string; unitName: string; sourceFid: number; scientificObjective: string; method: string;
  distanceToClippedUnitBoundaryM: number; sameTraversableComponentAsDemo15Deg: boolean;
  uncertainty: { noteEs: string; geologyRegistrationOffsetM: number[]; routingCellSizeM: number };
  sources: { title: string; url: string; sourceFid?: number }[];
}
export interface DocumentedPhoto {
  id: string; label: string; imageId: string; instrument: string; utc: string; sol: number; rmc: string;
  xy: [number, number]; cell: Cell; longitudeEastDeg: number; latitudePlanetocentricDeg: number; routingMask: number;
  file: string; bytes: number; sha256: string; credit: string; sourceImageUrl: string; sourcePageUrl: string; metadataUrl: string;
  waypointSourceUrl: string; waypointSourceSha256: string;
  waypoint: { rmc: string; sol: number; site: number; drive: number; coordinates: number[]; note: string };
  localizationMethod: string; locationMeaningEs: string;
  uncertainty: { absoluteAccuracyM: null; noteEs: string };
}
export interface ScienceManifest {
  schema: string; datasetId: string; crsProj: string; topographyManifestSha256: string;
  files: { file: string; sha256: string; bytes: number }[];
}
export interface ScienceData { manifest: ScienceManifest; manifestSha256: string; geology: Geology; objectives: ScienceObjective[]; photos: DocumentedPhoto[] }
export type ScienceSelection = { kind: 'unit'; id: number } | { kind: 'objective' | 'photo'; id: string } | null;

export function validateScience(data: ScienceData, grid: RoutingGrid): void {
  if (data.manifest.schema !== 'mars-pathfinder-science-v1' || data.manifest.datasetId !== 'jezero-science-v1' || data.manifest.crsProj !== grid.dataset.crsProj || data.manifest.topographyManifestSha256 !== grid.dataset.manifestSha256 || data.geology.topographyManifestSha256 !== grid.dataset.manifestSha256 || data.geology.crsProj !== grid.dataset.crsProj) throw new Error('The science data do not match the loaded topography version.');
  for (const point of [...data.objectives, ...data.photos]) {
    const cell = projectedToCell(grid, { x: point.xy[0], y: point.xy[1] });
    if (!cell || cell.col !== point.cell.col || cell.row !== point.cell.row || cellBlockReason(grid, indexOf(grid, cell), 89)) throw new Error(`Science point without a valid cell: ${point.id}`);
    const geographic = marsLonLat(grid, { x: point.xy[0], y: point.xy[1] });
    if (Math.abs(geographic.longitudeEastDeg - point.longitudeEastDeg) > 1e-8 || Math.abs(geographic.latitudeNorthDeg - point.latitudePlanetocentricDeg) > 1e-8) throw new Error(`Inconsistent coordinates: ${point.id}`);
  }
  for (const objective of data.objectives) {
    const p = cellCenter(grid, objective.cell);
    const feature = data.geology.features.find(x => x.id === objective.sourceFid);
    if (p.x !== objective.xy[0] || p.y !== objective.xy[1] || feature?.properties.symbol !== objective.unitSymbol || feature.properties.name !== objective.unitName) throw new Error(`Inconsistent geological provenance: ${objective.id}`);
  }
  for (const photo of data.photos) if (photo.waypoint.rmc !== photo.rmc || photo.waypoint.sol !== photo.sol || photo.rmc !== `${photo.waypoint.site}_${photo.waypoint.drive}` || !photo.imageId.includes(`N${String(photo.waypoint.site).padStart(3, '0')}${String(photo.waypoint.drive).padStart(4, '0')}`)) throw new Error(`Photograph without an RMC match: ${photo.id}`);
}
export async function loadScience(grid: RoutingGrid, signal?: AbortSignal): Promise<ScienceData> {
  const get = async (file: string) => {
    const response = await fetch(SCIENCE_URL + file, signal ? { signal } : {});
    if (!response.ok) throw new Error(`Could not load science data: ${file} (${response.status}).`);
    return response.arrayBuffer();
  };
  const manifestBytes = await get('manifest.json'), manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as ScienceManifest;
  const json = async (file: string) => {
    const entry = manifest.files.find(x => x.file === file); if (!entry) throw new Error(`Missing science contract: ${file}`);
    const bytes = await get(file);
    if (bytes.byteLength !== entry.bytes || await sha256(bytes) !== entry.sha256) throw new Error(`Science integrity check failed: ${file}`);
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const [geology, objectives, photos] = await Promise.all([json('geology.json'), json('objectives.json'), json('photos.json')]);
  if (objectives.geologySha256 !== manifest.files.find(x => x.file === 'geology.json')?.sha256) throw new Error('Objectives belong to a different geology version.');
  for (const source of [objectives, photos]) if (source.crsProj !== manifest.crsProj || source.topographyManifestSha256 !== manifest.topographyManifestSha256) throw new Error('Incompatible CRS or science version.');
  const data: ScienceData = { manifest, manifestSha256: await sha256(manifestBytes), geology, objectives: objectives.objectives, photos: photos.photos };
  validateScience(data, grid); return data;
}
