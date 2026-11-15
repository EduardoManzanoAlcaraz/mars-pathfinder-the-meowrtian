import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { build } from 'esbuild';
import { planRoute } from '../../lib/routing/engine.js';
import { loadLocalGrid } from '../../scripts/routing/local-data.js';
import type {} from './browser-harness.js';

let server: Server, browser: Browser, origin: string;
const evidence: Record<string, unknown> = {};
const cache = resolve('.cache/routing-browser');
beforeAll(async () => {
  await mkdir(cache, { recursive: true }); await mkdir('docs/routing-validation', { recursive: true });
  await build({ entryPoints: { harness: 'tests/routing/browser-harness.ts', 'routing.worker': 'workers/routing.worker.ts' }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outdir: cache });
  const files: Record<string, string> = { '/harness.js': resolve(cache, 'harness.js'), '/routing.worker.js': resolve(cache, 'routing.worker.js'),
    '/data/manifest.json': resolve('data/processed/jezero-hirise-v1/manifest.json'),
    '/data/routing_elevation.f32': resolve('data/processed/jezero-hirise-v1/routing_elevation.f32'),
    '/data/routing_slope_max.f32': resolve('data/processed/jezero-hirise-v1/routing_slope_max.f32'),
    '/data/routing_valid.u8': resolve('data/processed/jezero-hirise-v1/routing_valid.u8') };
  server = createServer((request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    if (path === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><meta charset="utf-8"><title>Routing worker automated test</title>'); return; }
    const file = files[path];
    if (!file) { response.writeHead(404); response.end(); return; }
    readFile(file).then(data => { response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.json') ? 'application/json' : 'application/octet-stream'); response.end(data); }, () => { response.writeHead(500); response.end(); });
  });
  await new Promise<void>(ready => server.listen(0, '127.0.0.1', ready));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Test server not listening');
  origin = `http://127.0.0.1:${address.port}`;
  let executablePath: string | undefined;
  for (const candidate of [process.env.MARS_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter((x): x is string => !!x)) {
    try { await access(candidate); executablePath = candidate; break; } catch { /* try next installed browser */ }
  }
  if (!executablePath) throw new Error('Set MARS_TEST_BROWSER to an installed Chromium executable; browser tests are mandatory, not skipped');
  browser = await chromium.launch({ executablePath, headless: true });
  evidence.browserVersion = browser.version(); evidence.executedAtUtc = new Date().toISOString();
});
afterAll(async () => {
  await browser?.close();
  if (server) {
    const closed = new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    server.closeAllConnections(); // Chromium may leave HTTP preconnect sockets after terminating workers.
    await closed;
  }
  await writeFile('docs/routing-validation/browser-worker.json', JSON.stringify(evidence, null, 2) + '\n');
});
async function page(): Promise<Page> {
  const p = await browser.newPage();
  await p.goto(origin); await p.addScriptTag({ type: 'module', url: origin + '/harness.js' });
  await p.waitForFunction(() => !!window.routingHarness);
  return p;
}
it('executes the production Web Worker on real Jezero data with matching metrics', async () => {
  const p = await page();
  const actual = await p.evaluate(() => window.routingHarness.realDemo());
  const { grid } = await loadLocalGrid();
  for (const r of actual.results) {
    const expected = planRoute(grid, { col: 59, row: 302 }, { col: 334, row: 53 }, { mode: r.lambda ? 'slope-penalty' : 'distance', lambda: r.lambda });
    expect(expected.status).toBe('success');
    if (expected.status === 'success') {
      expect(r.metrics.totalCost).toBeCloseTo(expected.metrics.totalCost, 7);
      expect(r.metrics.horizontalMeters).toBeCloseTo(expected.metrics.horizontalMeters, 7);
      expect(r.pathCells).toBe(expected.cells.length);
    }
    expect(r.audit.passed).toBe(true);
  }
  expect(actual.observations.created).toBe(1); expect(actual.originalArrayBytes).toBe(561056);
  evidence.realJezero = actual;
  await p.close();
});
for (const operation of ['cancelBusy', 'supersedeBusy'] as const) {
  it(`${operation}: closes a real actively computing worker and successfully recreates it`, async () => {
    const p = await page();
    const lifecycle: { event: string; url: string }[] = [];
    p.on('worker', w => {
      lifecycle.push({ event: 'created', url: w.url() });
      w.on('close', () => lifecycle.push({ event: 'closed', url: w.url() }));
    });
    const firstWorker = p.waitForEvent('worker');
    const pending = p.evaluate(operation => window.routingHarness[operation](), operation);
    const worker = await firstWorker;
    let actuallyClosed = false; worker.once('close', () => { actuallyClosed = true; });
    const result = await pending;
    evidence[operation] = { ...result, lifecycle, firstCloseObserved: actuallyClosed, activeWorkersAtReturn: p.workers().length };
    await expect.poll(() => actuallyClosed, { timeout: 5000 }).toBe(true);
    expect(result.firstStatus).toBe('cancelled');
    expect(result.firstReason).toBe(operation === 'cancelBusy' ? 'user' : 'superseded');
    expect(result.beforeReplacementResults).toBe(0); // First search never completed.
    expect(result.secondRouteStatus).toBe('success'); expect(result.latestOnly).toBe(true);
    expect(result.observations.created).toBe(2); expect(result.observations.terminated).toBe(1);
    expect(result.arrayBytesAfterRestart).toBe(16_000_000);
    evidence[operation] = { ...result, lifecycle, browserObservedTerminatedWorkerClose: actuallyClosed };
    await p.close();
  });
}
