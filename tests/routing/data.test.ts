import { describe, expect, it } from 'vitest';
import { decodePreparedGrid, parsePreparedManifest } from '../../lib/routing/load-grid.js';
import { cellCenter, projectedToCell } from '../../lib/routing/grid.js';
import { planRoute } from '../../lib/routing/engine.js';
import { loadLocalGrid } from '../../scripts/routing/local-data.js';
import { auditRoute } from '../../scripts/routing/independent-audit.js';

describe('existing real data contract', () => {
  it('loads verified binary hashes, dimensions, orientation and Float32 values', async () => {
    const { grid, manifest } = await loadLocalGrid();
    expect([grid.width, grid.height, grid.valid.length]).toEqual([394, 356, 140264]);
    expect(grid.transform).toEqual([-1968, 10, 0, 1095398, 0, -10]);
    expect(grid.nodata).toBe(-9999); expect(grid.valid.reduce((sum, x) => sum + x, 0)).toBe(138135);
    expect(grid.dataset.provenance).toBe('official-HiRISE-team-derived');
    expect(grid.dataset.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(grid.elevation).toBeInstanceOf(Float32Array); expect(grid.slope).toBeInstanceOf(Float32Array);
    expect(manifest.routing_grid.paths.dem_binary).toBe('routing_elevation.f32');
    expect(cellCenter(grid, { col: 0, row: 0 })).toEqual({ x: -1963, y: 1095393 });
    expect(projectedToCell(grid, { x: -1963, y: 1095393 })).toEqual({ col: 0, row: 0 });
  });
  it('rejects a corrupted binary and a truncated array before routing', async () => {
    const { assets, manifestBytes } = await loadLocalGrid();
    const bad = assets.dem_binary.slice(0), view = new Uint8Array(bad); view[25] = view[25]! ^ 1;
    await expect(decodePreparedGrid(manifestBytes, { ...assets, dem_binary: bad })).rejects.toThrow('SHA-256');
    await expect(decodePreparedGrid(manifestBytes, { ...assets, valid_binary: assets.valid_binary.slice(1) })).rejects.toThrow('Truncated');
  });
  it('rejects alternative byte order, layout, dimensions, units or mask contracts', async () => {
    const { manifest } = await loadLocalGrid();
    for (const edit of [{ binary_endianness: 'big' }, { binary_float_type: 'Float64' }, { layout: 'south-first' }, { total_cells: 1 }, { mask_codes: '0=safe' }, { resolution_m: 20 }]) expect(() => parsePreparedManifest({ ...manifest, routing_grid: { ...manifest.routing_grid, ...edit } })).toThrow();
    expect(() => parsePreparedManifest({ ...manifest, local_crs_proj: '+proj=longlat +datum=WGS84' })).toThrow('CRS');
  });
  it('calculates and independently audits both modes on a fixed real Jezero pair', async () => {
    const { grid } = await loadLocalGrid();
    for (const lambda of [0, 4]) {
      const result = planRoute(grid, { col: 59, row: 302 }, { col: 334, row: 53 }, { mode: lambda ? 'slope-penalty' : 'distance', lambda });
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(auditRoute(grid, result).passed).toBe(true);
        expect(result.metrics.totalCost).toBeGreaterThan(0);
        expect(result.dataset.id).toBe('jezero-hirise-v1');
      }
    }
  });
});
