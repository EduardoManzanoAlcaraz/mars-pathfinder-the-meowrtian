// Test harness only; no product interface. Executes the real module worker in Chrome.
import { loadPreparedGrid } from '../../lib/routing/load-grid.js';
import { adaptBrowserWorker, RoutingWorkerClient } from '../../lib/routing/worker-client.js';
import { auditRoute } from '../../scripts/routing/independent-audit.js';
import { fixture } from './fixtures.js';
import type { RoutingGrid } from '../../lib/routing/types.js';
import type { WorkerResponse } from '../../lib/routing/worker-protocol.js';
import type { WorkerOutcome } from '../../lib/routing/worker-client.js';

function createClient(grid: RoutingGrid, onStarted?: () => void) {
  const observations = { created: 0, terminated: 0, started: 0, resultMessages: 0 };
  const client = new RoutingWorkerClient(grid, () => {
    const native = new Worker('/routing.worker.js', { type: 'module' }); observations.created++;
    native.addEventListener('message', ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === 'started') { observations.started++; onStarted?.(); }
      if (data.type === 'result') observations.resultMessages++;
    });
    const port = adaptBrowserWorker(native), terminate = port.terminate;
    port.terminate = () => { observations.terminated++; terminate(); };
    return port;
  });
  return { client, observations };
}
async function realDemo() {
  const grid = await loadPreparedGrid(new URL('/data/manifest.json', location.href));
  const { client, observations } = createClient(grid);
  const results = [];
  for (const lambda of [0, 4]) {
    const began = performance.now();
    const outcome = await client.request({ col: 59, row: 302 }, { col: 334, row: 53 }, { mode: lambda ? 'slope-penalty' : 'distance', lambda });
    const roundTripMs = performance.now() - began;
    if (outcome.status !== 'completed' || outcome.result.status !== 'success') throw new Error(JSON.stringify(outcome));
    const r = outcome.result;
    results.push({ lambda, metrics: r.metrics, computeTimeMs: r.computeTimeMs, roundTripMs, pathCells: r.cells.length, expandedCells: r.expandedCells, audit: auditRoute(grid, r), requestId: outcome.requestId });
  }
  client.dispose();
  return { results, observations, originalArrayBytes: grid.elevation.byteLength };
}
async function interruptBusySearch(supersede: boolean) {
  // Artificial stress fixture, not scientific data. Without termination A* must
  // explore two million cells on the unreachable side of the wall.
  const grid = fixture(2000, 2000);
  for (let row = 0; row < grid.height; row++) grid.valid[row * grid.width + 1000] = 0;
  let fired = false, next: Promise<WorkerOutcome> | null = null;
  const { client, observations } = createClient(grid, () => {
    if (fired) return; fired = true;
    // Give the browser-debug protocol time to observe the live worker before
    // termination. The real A* stress query must still be pending at cancel.
    setTimeout(() => {
      if (supersede) next = client.request({ col: 1, row: 1 }, { col: 2, row: 2 }, { mode: 'distance' });
      else client.cancel();
    }, 50);
  });
  const first = await client.request({ col: 0, row: 1000 }, { col: 1999, row: 1000 }, { mode: 'distance' });
  const beforeReplacementResults = observations.resultMessages;
  const second = await (next ?? client.request({ col: 1, row: 1 }, { col: 2, row: 2 }, { mode: 'distance' }));
  const latestOnly = !client.isCurrent(first.requestId) && client.isCurrent(second.requestId);
  const result = { firstStatus: first.status, firstReason: first.status === 'cancelled' ? first.reason : null,
    secondStatus: second.status, secondRouteStatus: second.status === 'completed' ? second.result.status : null,
    beforeReplacementResults, latestOnly, observations: { ...observations }, arrayBytesAfterRestart: grid.elevation.byteLength };
  client.dispose(); return result;
}
const harness = { realDemo, cancelBusy: () => interruptBusySearch(false), supersedeBusy: () => interruptBusySearch(true) };
declare global { interface Window { routingHarness: typeof harness } }
window.routingHarness = harness;
