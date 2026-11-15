import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { BINARY_ROLES, decodePreparedGrid, parsePreparedManifest } from '../../lib/routing/load-grid.js';
import type { BinaryRole } from '../../lib/routing/load-grid.js';

export function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length); copy.set(bytes); return copy.buffer;
}
export async function loadLocalGrid(manifestPath = resolve('data/processed/jezero-hirise-v1/manifest.json')) {
  const manifestBytes = exactBuffer(await readFile(manifestPath));
  const manifest = parsePreparedManifest(JSON.parse(new TextDecoder().decode(manifestBytes)));
  const entries = await Promise.all(BINARY_ROLES.map(async role => [role, exactBuffer(await readFile(resolve(dirname(manifestPath), manifest.routing_grid.paths[role])))] as const));
  const assets = Object.fromEntries(entries) as Record<BinaryRole, ArrayBuffer>;
  return { grid: await decodePreparedGrid(manifestBytes, assets), manifest, manifestBytes, assets };
}
