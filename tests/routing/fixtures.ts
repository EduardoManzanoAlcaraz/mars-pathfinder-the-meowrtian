import type { RoutingGrid } from '../../lib/routing/types.js';
export function fixture(width: number, height: number, values: { z?: number[]; slopes?: number[]; mask?: number[]; resolution?: number } = {}): RoutingGrid {
  const n = width * height, resolution = values.resolution ?? 10;
  return { width, height, transform: [0, resolution, 0, height * resolution, 0, -resolution], nodata: -9999,
    elevation: Float32Array.from(values.z ?? new Array(n).fill(0)), slope: Float32Array.from(values.slopes ?? new Array(n).fill(0)), valid: Uint8Array.from(values.mask ?? new Array(n).fill(1)),
    dataset: { id: 'synthetic-test-fixture-v1', provenance: 'synthetic-test-fixture', manifestSha256: '', assets: {}, crsWkt: 'Synthetic local metre test grid', crsProj: 'Synthetic metric grid (not scientific Mars data)', verticalReference: 'Analytical fixture only' } };
}
