import { describe, expect, it } from 'vitest';
import { BinaryMinHeap } from '../../lib/routing/heap.js';
import { cellCenter, projectedToCell } from '../../lib/routing/grid.js';
import { computeMetrics, normalizeOptions, planRoute } from '../../lib/routing/engine.js';
import { auditRoute } from '../../scripts/routing/independent-audit.js';
import { fixture } from './fixtures.js';
import { dijkstraReference } from './dijkstra-reference.js';

describe('heap', () => {
  it('orders entries deterministically and decreases keys without duplicates', () => {
    const heap = new BinaryMinHeap(100);
    for (let i = 99; i >= 0; i--) heap.set(i, i + 100);
    heap.set(88, -1); heap.set(87, -1); heap.set(86, -1, -1);
    expect(heap.size).toBe(100);
    expect([heap.pop(), heap.pop(), heap.pop()]).toEqual([86, 87, 88]);
    const rest: number[] = [];
    while (heap.size) rest.push(heap.pop()!);
    expect(rest).toEqual(Array.from({ length: 100 }, (_, i) => i).filter(x => ![86, 87, 88].includes(x)));
    expect(heap.pop()).toBeUndefined();
  });
});
describe('navigation constraints', () => {
  it('minimizes metric horizontal distance on flat terrain', () => {
    const r = planRoute(fixture(5, 3), { col: 0, row: 1 }, { col: 4, row: 1 }, { mode: 'distance' });
    expect(r.status).toBe('success');
    if (r.status !== 'success') return;
    expect(r.metrics.horizontalMeters).toBe(40); expect(r.metrics.totalCost).toBe(40);
    expect(r.metrics.terrainMeters).toBe(40); expect(r.metrics.maxSlopeDeg).toBe(0);
    expect(r.computeTimeMs).toBeGreaterThanOrEqual(0);
  });
  it('uses diagonal movement with its real sqrt(2) length', () => {
    const r = planRoute(fixture(4, 4), { col: 0, row: 0 }, { col: 3, row: 3 }, { mode: 'distance' });
    expect(r.status).toBe('success');
    if (r.status === 'success') { expect(r.cells).toEqual([0, 5, 10, 15]); expect(r.metrics.horizontalMeters).toBeCloseTo(30 * Math.SQRT2, 10); }
  });
  it('routes around obstacles without crossing closed corners', () => {
    const grid = fixture(5, 3, { mask: [1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1] });
    const r = planRoute(grid, { col: 0, row: 1 }, { col: 4, row: 1 }, { mode: 'distance' });
    expect(r.status).toBe('success');
    if (r.status === 'success') { expect(r.metrics.horizontalMeters).toBe(60); expect(auditRoute(grid, r).passed).toBe(true); }
  });
  it('blocks a diagonal when both orthogonal corner cells are unknown', () => {
    const r = planRoute(fixture(2, 2, { mask: [1, 0, 0, 1] }), { col: 0, row: 0 }, { col: 1, row: 1 }, { mode: 'distance' });
    expect(r.status).toBe('no-route'); expect(r.expandedCells).toBe(1);
  });
  it('cannot cut even a single blocked corner but can take the other two steps', () => {
    const r = planRoute(fixture(2, 2, { mask: [1, 0, 1, 1] }), { col: 0, row: 0 }, { col: 1, row: 1 }, { mode: 'distance' });
    expect(r.status).toBe('success'); if (r.status === 'success') expect(r.cells).toEqual([0, 2, 3]);
  });
  it('rejects slopes above the configured maximum', () => {
    expect(planRoute(fixture(3, 1, { slopes: [0, 16, 0] }), { col: 0, row: 0 }, { col: 2, row: 0 }, { mode: 'distance' }).status).toBe('no-route');
    expect(planRoute(fixture(3, 1, { slopes: [0, 16, 0] }), { col: 0, row: 0 }, { col: 2, row: 0 }, { mode: 'distance', maxSlopeDeg: 16 }).status).toBe('success');
  });
  it('evaluates centre-to-centre slope even when supplied cell slopes are flat', () => {
    const grid = fixture(2, 1, { z: [0, 10] });
    expect(planRoute(grid, { col: 0, row: 0 }, { col: 1, row: 0 }, { mode: 'distance', maxSlopeDeg: 15 }).status).toBe('no-route');
    const r = planRoute(grid, { col: 0, row: 0 }, { col: 1, row: 0 }, { mode: 'distance', maxSlopeDeg: 45 });
    expect(r.status).toBe('success'); if (r.status === 'success') expect(r.metrics.maxSlopeDeg).toBeCloseTo(45, 10);
  });
  it.each([-9999, NaN, Infinity])('blocks invalid elevation %s even if the mask claims validity', z => {
    const r = planRoute(fixture(3, 1, { z: [0, z, 0] }), { col: 0, row: 0 }, { col: 2, row: 0 }, { mode: 'distance' });
    expect(r.status).toBe('no-route');
  });
  it('blocks NoData and invalid slope values', () => {
    for (const slope of [-9999, NaN, Infinity, -1, 90]) expect(planRoute(fixture(3, 1, { slopes: [0, slope, 0] }), { col: 0, row: 0 }, { col: 2, row: 0 }, { mode: 'distance' }).status).toBe('no-route');
  });
  it('returns a zero-length route only when the identical endpoint is valid', () => {
    const r = planRoute(fixture(2, 2), { col: 1, row: 1 }, { col: 1, row: 1 }, { mode: 'distance' });
    expect(r.status).toBe('success'); if (r.status === 'success') { expect(r.cells).toEqual([3]); expect(r.metrics.horizontalMeters).toBe(0); expect(r.metrics.totalCost).toBe(0); expect(r.metrics.exposure.every(x => x.fractionOfHorizontalLength === 0)).toBe(true); }
    expect(planRoute(fixture(1, 1, { mask: [0] }), { col: 0, row: 0 }, { col: 0, row: 0 }, { mode: 'distance' }).status).toBe('invalid-start');
  });
  it.each([{ col: -1, row: 0 }, { col: 2, row: 0 }, { col: 0, row: 2 }, { col: 0.5, row: 0 }, { col: NaN, row: 0 }])('rejects invalid destination %j without clamping', goal => {
    expect(planRoute(fixture(2, 2), { col: 0, row: 0 }, goal, { mode: 'distance' }).status).toBe('invalid-goal');
  });
  it('rejects invalid/steep endpoints and disconnected destinations explicitly', () => {
    expect(planRoute(fixture(2, 1, { slopes: [16, 0] }), { col: 0, row: 0 }, { col: 1, row: 0 }, { mode: 'distance' }).status).toBe('invalid-start');
    expect(planRoute(fixture(2, 1, { mask: [1, 0] }), { col: 0, row: 0 }, { col: 1, row: 0 }, { mode: 'distance' }).status).toBe('invalid-goal');
    expect(planRoute(fixture(3, 1, { mask: [1, 0, 1] }), { col: 0, row: 0 }, { col: 2, row: 0 }, { mode: 'distance' }).status).toBe('no-route');
  });
  it('rejects inconsistent array sizes and invalid configuration', () => {
    expect(planRoute(fixture(2, 2, { z: [0] }), { col: 0, row: 0 }, { col: 1, row: 1 }, { mode: 'distance' }).status).toBe('invalid-grid');
    for (const options of [{ mode: 'distance', lambda: 4 }, { mode: 'slope-penalty', lambda: -1 }, { mode: 'distance', maxSlopeDeg: 90 }, { mode: 'distance', thetaRefDeg: 0 }, { mode: 'slope-penalty', lambda: 1e308 }, { mode: 'distance', exposureBinsDeg: [0, 5, 5, 90] }] as const) expect(planRoute(fixture(2, 2), { col: 0, row: 0 }, { col: 1, row: 1 }, options).status).toBe('invalid-parameters');
  });
  it('maps north-up cell centres correctly and rejects the east/south boundary', () => {
    const grid = fixture(2, 2); expect(cellCenter(grid, { col: 0, row: 0 })).toEqual({ x: 5, y: 15 });
    expect(projectedToCell(grid, { x: 15, y: 5 })).toEqual({ col: 1, row: 1 });
    expect(projectedToCell(grid, { x: 20, y: 5 })).toBeNull(); expect(projectedToCell(grid, { x: 5, y: 0 })).toBeNull();
  });
});
describe('cost and metrics', () => {
  it('calculates a known up/down profile and exposure intervals independently', () => {
    const grid = fixture(3, 1, { z: [0, 3, 1], resolution: 4 });
    const p = normalizeOptions({ mode: 'slope-penalty', lambda: 4, maxSlopeDeg: 50, exposureBinsDeg: [0, 30, 40, 90] });
    const m = computeMetrics(grid, [0, 1, 2], p);
    expect(m.horizontalMeters).toBe(8); expect(m.terrainMeters).toBeCloseTo(5 + Math.sqrt(20), 12);
    expect([m.ascentMeters, m.descentMeters, m.netElevationMeters]).toEqual([3, 2, 1]);
    const a = Math.atan(3 / 4) * 180 / Math.PI, b = Math.atan(2 / 4) * 180 / Math.PI;
    expect(m.maxSlopeDeg).toBeCloseTo(a, 12);
    expect(m.totalCost).toBeCloseTo(4 * (1 + 4 * (a / 15) ** 2) + 4 * (1 + 4 * (b / 15) ** 2), 10);
    expect(m.exposure.map(x => x.horizontalMeters)).toEqual([4, 4, 0]); expect(m.exposure.map(x => x.fractionOfHorizontalLength)).toEqual([0.5, 0.5, 0]);
    const reverse = computeMetrics(grid, [2, 1, 0], p); expect(reverse.ascentMeters).toBe(2); expect(reverse.descentMeters).toBe(3); expect(reverse.netElevationMeters).toBe(-1);
  });
  it('lambda=0 finds the short route; lambda=4 takes a lower-penalty detour in this fixture', () => {
    const slopes = new Array<number>(15).fill(0); slopes[7] = 14;
    const grid = fixture(5, 3, { slopes });
    const a = planRoute(grid, { col: 0, row: 1 }, { col: 4, row: 1 }, { mode: 'distance' });
    const b = planRoute(grid, { col: 0, row: 1 }, { col: 4, row: 1 }, { mode: 'slope-penalty', lambda: 4 });
    expect(a.status).toBe('success'); expect(b.status).toBe('success');
    if (a.status === 'success' && b.status === 'success') { expect(a.metrics.horizontalMeters).toBe(40); expect(a.cells).toContain(7); expect(b.cells).not.toContain(7); expect(b.metrics.horizontalMeters).toBeGreaterThan(40); expect(b.metrics.maxSlopeDeg).toBe(0); }
  });
  it.each([0, 0.25, 1, 4, 20])('matches independent Dijkstra on 30 seeded maps for lambda=%s', lambda => {
    let seed = 481516;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let repeat = 0; repeat < 30; repeat++) {
      const mask = Array.from({ length: 42 }, () => random() > 0.2 ? 1 : 0), z = Array.from({ length: 42 }, () => random() * 4), slopes = Array.from({ length: 42 }, () => random() * 19);
      mask[0] = mask[41] = 1; slopes[0] = slopes[41] = 0;
      const grid = fixture(7, 6, { mask, z, slopes }), start = { col: 0, row: 0 }, goal = { col: 6, row: 5 };
      const reference = dijkstraReference(grid, start, goal, lambda);
      const result = planRoute(grid, start, goal, { mode: 'slope-penalty', lambda });
      if (reference === Infinity) expect(result.status).toBe('no-route');
      else { expect(result.status).toBe('success'); if (result.status === 'success') { expect(result.metrics.totalCost).toBeCloseTo(reference, 8); expect(auditRoute(grid, result).passed).toBe(true); } }
    }
  });
});
