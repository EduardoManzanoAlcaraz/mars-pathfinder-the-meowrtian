import { expect, it } from 'vitest';
import { RoutingWorkerClient } from '../../lib/routing/worker-client.js';
import type { WorkerLike } from '../../lib/routing/worker-client.js';
import type { WorkerRequest, WorkerResponse } from '../../lib/routing/worker-protocol.js';
import { planRoute } from '../../lib/routing/engine.js';
import { fixture } from './fixtures.js';

class TestWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  terminated = false;
  sent: WorkerRequest[] = [];
  postMessage(message: WorkerRequest): void { this.sent.push(message); }
  terminate(): void { this.terminated = true; }
  emit(message: WorkerResponse): void { this.onmessage?.({ data: message }); }
}
it('terminates an active request, recreates the worker and ignores a queued stale callback', async () => {
  const grid = fixture(3, 3), workers: TestWorker[] = [];
  const client = new RoutingWorkerClient(grid, () => { const w = new TestWorker(); workers.push(w); return w; });
  const start = { col: 0, row: 0 }, goal = { col: 2, row: 2 }, options = { mode: 'distance' } as const;
  const first = client.request(start, goal, options);
  workers[0]!.emit({ type: 'ready' });
  const queuedOldCallback = workers[0]!.onmessage!;
  const second = client.request(start, goal, options);
  expect(workers[0]!.terminated).toBe(true); expect(workers.length).toBe(2);
  expect(await first).toMatchObject({ status: 'cancelled', reason: 'superseded', requestId: 1 });
  workers[1]!.emit({ type: 'ready' });
  const result = planRoute(grid, start, goal, options);
  queuedOldCallback({ data: { type: 'result', requestId: 1, result } });
  workers[1]!.emit({ type: 'result', requestId: 2, result });
  const completed = await second;
  expect(completed).toMatchObject({ status: 'completed', requestId: 2 });
  expect(client.isCurrent(1)).toBe(false); expect(client.isCurrent(2)).toBe(true);
  expect(grid.elevation.byteLength).toBe(36); // Not detached during restart.
  client.dispose(); expect(workers[1]!.terminated).toBe(true);
});
it('supports explicit cancel, worker errors and permanent disposal', async () => {
  const w = new TestWorker(), client = new RoutingWorkerClient(fixture(2, 2), () => w);
  const pending = client.request({ col: 0, row: 0 }, { col: 1, row: 1 }, { mode: 'distance' });
  client.cancel(); expect(await pending).toMatchObject({ status: 'cancelled', reason: 'user' }); expect(w.terminated).toBe(true);
  client.dispose(); await expect(client.request({ col: 0, row: 0 }, { col: 1, row: 1 }, { mode: 'distance' })).rejects.toThrow('disposed');
  const other = new TestWorker(), c = new RoutingWorkerClient(fixture(2, 2), () => other);
  const failure = c.request({ col: 0, row: 0 }, { col: 1, row: 1 }, { mode: 'distance' });
  other.onerror?.({ message: 'test transport failure' });
  expect(await failure).toMatchObject({ status: 'error', message: 'test transport failure' }); expect(other.terminated).toBe(true);
});
