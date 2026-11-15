import { assertGrid } from './grid.js';
import type { Affine, RoutingGrid } from './types.js';

const LAYOUT = 'row-major, row 0 north; centres at col+0.5,row+0.5';
const MASK = '0=blocked/unknown, 1=valid (slope policy still to be applied)';
export interface PreparedManifest {
  dataset_id: string; local_crs_wkt: string; local_crs_proj: string; vertical_reference: string;
  routing_grid: {
    width: number; height: number; resolution_m: number; transform_gdal: Affine;
    layout: string; binary_endianness: string; binary_float_type: string;
    nodata_float: number; mask_codes: string; total_cells: number;
    paths: { dem_binary: string; slope_binary: string; valid_binary: string };
  };
  outputs: { path: string; bytes: number; sha256: string }[];
}
export type BinaryRole = 'dem_binary' | 'slope_binary' | 'valid_binary';
export const BINARY_ROLES: readonly BinaryRole[] = ['dem_binary', 'slope_binary', 'valid_binary'];

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object'; }
/** Adapter for the EXISTING manifest, including its explicit text layout contract. */
export function parsePreparedManifest(value: unknown): PreparedManifest {
  if (!record(value) || !record(value.routing_grid)) throw new Error('Missing routing_grid in prepared manifest');
  const r = value.routing_grid;
  if (typeof value.dataset_id !== 'string' || !value.dataset_id || typeof value.local_crs_wkt !== 'string' || typeof value.local_crs_proj !== 'string' || typeof value.vertical_reference !== 'string') throw new Error('Missing dataset/CRS identity');
  if (!value.local_crs_proj.includes('+proj=eqc') || !value.local_crs_proj.includes('+units=m') || !value.local_crs_proj.includes('+R=3396190')) throw new Error('Unsupported CRS: expected the prepared local Mars sphere in metres');
  if (!Number.isSafeInteger(r.width) || !Number.isSafeInteger(r.height) || (r.width as number) < 1 || (r.height as number) < 1 || r.total_cells !== (r.width as number) * (r.height as number)) throw new Error('Manifest grid dimensions inconsistent');
  if (r.layout !== LAYOUT || r.binary_endianness !== 'little' || r.binary_float_type !== 'Float32' || r.mask_codes !== MASK || !Number.isFinite(r.nodata_float)) throw new Error('Unsupported binary layout, mask or NoData contract');
  const t = r.transform_gdal;
  if (!Array.isArray(t) || t.length !== 6 || !t.every(Number.isFinite) || t[1] !== r.resolution_m || t[5] !== -(r.resolution_m as number) || t[2] !== 0 || t[4] !== 0 || !(t[1] > 0)) throw new Error('Manifest transform differs from north-up metric resolution');
  if (!record(r.paths) || !BINARY_ROLES.every(role => typeof (r.paths as Record<string, unknown>)[role] === 'string' && /^[a-zA-Z0-9_.-]+$/.test((r.paths as Record<string, string>)[role]!))) throw new Error('Missing or invalid binary filenames');
  if (!Array.isArray(value.outputs) || !value.outputs.every(x => record(x) && typeof x.path === 'string' && Number.isSafeInteger(x.bytes) && typeof x.sha256 === 'string' && /^[0-9a-f]{64}$/.test(x.sha256))) throw new Error('Missing size/hash inventory');
  const manifest = value as unknown as PreparedManifest;
  for (const role of BINARY_ROLES) {
    const entry = assetEntry(manifest, role);
    if (entry.bytes !== manifest.routing_grid.total_cells * (role === 'valid_binary' ? 1 : 4)) throw new Error(`Manifest byte count mismatch for ${role}`);
  }
  return manifest;
}
export function assetEntry(manifest: PreparedManifest, role: BinaryRole): PreparedManifest['outputs'][number] {
  const suffix = `/${manifest.routing_grid.paths[role]}`;
  const entries = manifest.outputs.filter(x => x.path.endsWith(suffix));
  if (entries.length !== 1) throw new Error(`Expected one manifest output for ${role}`);
  return entries[0]!;
}
export async function sha256(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
}
function decodeFloat32(bytes: ArrayBuffer): Float32Array {
  const view = new DataView(bytes), out = new Float32Array(bytes.byteLength / 4);
  // Explicit endianness, independent of the host CPU and Buffer byte offsets.
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}
export async function decodePreparedGrid(manifestBytes: ArrayBuffer, assets: Record<BinaryRole, ArrayBuffer>): Promise<RoutingGrid> {
  const manifest = parsePreparedManifest(JSON.parse(new TextDecoder().decode(manifestBytes)));
  const hashes: Record<string, string> = {};
  await Promise.all(BINARY_ROLES.map(async role => {
    const entry = assetEntry(manifest, role), data = assets[role];
    if (data.byteLength !== entry.bytes) throw new Error(`Truncated or oversized ${role}`);
    const hash = await sha256(data);
    if (hash !== entry.sha256) throw new Error(`SHA-256 mismatch for ${role}`);
    hashes[manifest.routing_grid.paths[role]] = hash;
  }));
  const r = manifest.routing_grid;
  const grid: RoutingGrid = { width: r.width, height: r.height, transform: [...r.transform_gdal], nodata: r.nodata_float,
    elevation: decodeFloat32(assets.dem_binary), slope: decodeFloat32(assets.slope_binary), valid: new Uint8Array(assets.valid_binary.slice(0)),
    dataset: { id: manifest.dataset_id, provenance: 'official-HiRISE-team-derived', manifestSha256: await sha256(manifestBytes), assets: hashes,
      crsWkt: manifest.local_crs_wkt, crsProj: manifest.local_crs_proj, verticalReference: manifest.vertical_reference } };
  if (grid.valid.some(x => x !== 0 && x !== 1)) throw new Error('Validity mask contains codes outside 0/1');
  assertGrid(grid);
  return grid;
}
/** Fetches only manifest-declared binaries; no NASA requests or reprocessing. */
export async function loadPreparedGrid(manifestUrl: string | URL, signal?: AbortSignal): Promise<RoutingGrid> {
  const url = new URL(manifestUrl, globalThis.location?.href);
  const options = signal ? { signal } : {};
  const fetchBytes = async (address: URL) => {
    const response = await fetch(address, options);
    if (!response.ok) throw new Error(`Dataset request failed: ${response.status} ${address.pathname}`);
    return response.arrayBuffer();
  };
  const manifestBytes = await fetchBytes(url);
  const manifest = parsePreparedManifest(JSON.parse(new TextDecoder().decode(manifestBytes)));
  const entries = await Promise.all(BINARY_ROLES.map(async role => [role, await fetchBytes(new URL(manifest.routing_grid.paths[role], url))] as const));
  return decodePreparedGrid(manifestBytes, Object.fromEntries(entries) as Record<BinaryRole, ArrayBuffer>);
}
