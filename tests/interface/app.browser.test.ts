import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { startStaticServer } from '../../scripts/web/serve-static.mjs';
import { loadLocalGrid } from '../../scripts/routing/local-data.js';
import { auditRoute } from '../../scripts/routing/independent-audit.js';
import { evaluateEdge, normalizeOptions, planRoute } from '../../lib/routing/engine.js';
import { cellCenter, cellOf } from '../../lib/routing/grid.js';
import type { Cell, RouteSuccess, RoutingGrid, XY } from '../../lib/routing/types.js';
import type { DocumentedPhoto, ScienceObjective } from '../../lib/science/model.js';
import { compareRoutes } from '../../lib/map/route-comparison.js';
import { assertEnglishUI } from '../../scripts/audit/english-ui.js';

let server: Server, browser: Browser, base: string, page: Page, grid: RoutingGrid;
const evidence: Record<string, unknown> = {}, output = 'docs/interface-validation';
let errors: string[], badResponses: string[], requests: string[];
const start = { col: 59, row: 302 }, goal = { col: 334, row: 53 };
function expectedRoute(a = start, b = goal, lambda = 4): RouteSuccess {
  const r = planRoute(grid, a, b, { mode: lambda === 0 ? 'distance' : 'slope-penalty', lambda, maxSlopeDeg: 15, thetaRefDeg: 15 });
  if (r.status !== 'success') throw new Error(`Expected actual route: ${r.status}`); return r;
}
beforeAll(async () => {
  await access('out/index.html'); await mkdir(output, { recursive: true });
  grid = (await loadLocalGrid()).grid;
  server = await startStaticServer({ port: 0 });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No static server');
  base = `http://127.0.0.1:${address.port}`;
  let executablePath: string | undefined;
  for (const path of [process.env.MARS_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) {
    if (!path) continue; try { await access(path); executablePath = path; break; } catch { /* next installed browser */ }
  }
  if (!executablePath) throw new Error('MARS_TEST_BROWSER must point to installed Chromium; browser checks cannot be skipped.');
  browser = await chromium.launch({ executablePath, headless: true });
  evidence.executedAtUtc = new Date().toISOString(); evidence.browser = browser.version();
  evidence.manifestSha256 = grid.dataset.manifestSha256; evidence.served = 'Actual out/ export over local HTTP';
});
beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1, acceptDownloads: true });
  errors = []; badResponses = []; requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => requests.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });
});
afterEach(async () => {
  if (page) {
    if (!errors.length && !badResponses.length) await assertEnglishUI(page);
    if (errors.length || badResponses.length) await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    await page.close();
  }
  expect(errors, 'Uncaught JS / console errors').toEqual([]);
  expect(badResponses, 'Missing static assets').toEqual([]);
  expect(requests.every(url => url.startsWith(base) || url.startsWith('blob:')), 'Demo must be self-contained after install/build').toBe(true);
});
afterAll(async () => {
  await browser?.close();
  if (server) {
    const closed = new Promise<void>((done, reject) => server.close(e => e ? reject(e) : done()));
    server.closeAllConnections(); await closed;
  }
  await writeFile(`${output}/browser.json`, JSON.stringify(evidence, null, 2) + '\n');
});
async function ready() {
  await page.goto(base); await page.waitForFunction(() => document.querySelector('[data-map-ready="true"]'));
  await page.getByText('HiRISE verified', { exact: true }).waitFor();
}
async function calculate() {
  await page.getByRole('button', { name: 'Calculate routes', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-calculation-state="complete"]'));
}
async function pixel(xy: XY) {
  const map = page.getByTestId('mars-map'), box = await map.boundingBox();
  if (!box) throw new Error('Missing map geometry');
  const cx = Number(await map.getAttribute('data-center-x')), cy = Number(await map.getAttribute('data-center-y')), res = Number(await map.getAttribute('data-resolution'));
  return { x: box.x + box.width / 2 + (xy.x - cx) / res, y: box.y + box.height / 2 + (cy - xy.y) / res };
}
async function pick(cell: Cell, kind: 'origin' | 'destination') {
  await page.getByRole('button', { name: `Select ${kind}`, exact: true }).click();
  const p = await pixel(cellCenter(grid, cell)); await page.mouse.click(p.x, p.y);
  const attr = kind === 'origin' ? 'data-origin-cell' : 'data-destination-cell';
  await expect.poll(() => page.getByTestId('mars-map').getAttribute(attr)).toBe(JSON.stringify(cell));
}
async function markerError(cell: Cell, kind: 'origin' | 'destination') {
  const screen = await pixel(cellCenter(grid, cell));
  const box = await page.getByRole('img', { name: `${kind === 'origin' ? 'Origin' : 'Destination'} marker`, exact: true }).boundingBox();
  if (!box) throw new Error('Missing marker');
  return Math.hypot(box.x + box.width / 2 - screen.x, box.y + box.height / 2 - screen.y);
}
async function metric(id: string) { return Number(await page.getByTestId(id).getAttribute('data-value')); }
async function exportAndAudit(id: 'a' | 'b', expected: RouteSuccess) {
  await page.getByRole('button', { name: `View route profile ${id.toUpperCase()}` }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await pending, path = `${output}/download-route-${id}.json`;
  await download.saveAs(path);
  const json = JSON.parse(await readFile(path, 'utf8'));
  expect(download.suggestedFilename()).toBe(`mars-pathfinder-jezero-hirise-v1-route-${id}.json`);
  expect(json.cells).toEqual(expected.cells); expect(json.metrics).toEqual(expected.metrics);
  expect(json.dataset.manifestSha256).toBe(grid.dataset.manifestSha256);
  expect(json.coordinateSystem.body).toBe('Mars'); expect(json.selectedOrigin.col).toBe(start.col);
  const audit = auditRoute(grid, json as RouteSuccess); expect(audit.passed).toBe(true);
  expect(json.coordinates.length).toBe(expected.cells.length);
  return { file: path, computeTimeMs: json.computeTimeMs, audit, parameters: json.parameters };
}

it('loads the real static map, all registered layers, metric scale and scientific provenance', async () => {
  await ready();
  const map = page.getByTestId('mars-map');
  expect(await page.getByTestId('a-horizontalMeters').getAttribute('data-value')).toBe('');
  expect(await page.locator('.mars-scale-inner').innerText()).toMatch(/m|km/);
  const canvasHashes: string[] = [];
  for (const [name, file] of [['Orthoimage', 'ortho'], ['Hillshade', 'hillshade'], ['Elevation', 'elevation'], ['Slope', 'slope']]) {
    await page.getByRole('radio', { name: name!, exact: true }).click();
    await page.waitForFunction(file => performance.getEntriesByType('resource').some(x => x.name.endsWith(`/${file}.webp`)), file!);
    await page.waitForTimeout(200); // image decode/render, not route timing
    const data = await map.locator('canvas').first().evaluate((c: HTMLCanvasElement) => c.toDataURL());
    canvasHashes.push((await import('node:crypto')).createHash('sha256').update(data).digest('hex'));
    await map.screenshot({ path: `${output}/layer-${file}.png` });
  }
  expect(new Set(canvasHashes).size).toBe(4);
  await page.getByRole('button', { name: 'Provenance and resolution' }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor({ state: 'visible' });
  expect(await dialog.innerText()).toContain('jezero-hirise-v1');
  expect(await dialog.innerText()).toContain('4 m visual');
  await dialog.locator('summary').click(); expect(await dialog.innerText()).toContain(grid.dataset.manifestSha256);
  expect(await dialog.locator('a[href*="uahirise.org"]').count()).toBe(3);
  expect(await dialog.locator('a[href="https://doi.org/10.3133/sim3464"]').count()).toBe(1);
  await page.screenshot({ path: `${output}/sources.png`, fullPage: true });
  await page.getByRole('button', { name: 'Close sources' }).click();
  evidence.map = { fourDistinctRenderedLayers: true, canvasHashes, noExternalRequests: true, localMetricScale: await page.locator('.mars-scale-inner').innerText(), provenanceDialogChecked: true };
});

it('turns actual map clicks into real routes, audits downloaded JSON and stays aligned through zoom/pan/layers', async () => {
  await ready(); await pick(start, 'origin'); await pick(goal, 'destination');
  const a = expectedRoute(start, goal, 0), b = expectedRoute();
  await page.evaluate(() => {
    const observation = { frames: 0, activeFrames: 0, gaps: [] as number[], previous: performance.now(), done: false };
    (window as unknown as { interfaceFrames: typeof observation }).interfaceFrames = observation;
    const frame = (time: number) => { if (observation.done) return; observation.frames++;
      if (document.querySelector('[data-calculation-state="working"]')) { observation.activeFrames++; observation.gaps.push(time - observation.previous); }
      observation.previous = time; requestAnimationFrame(frame); }; requestAnimationFrame(frame);
  });
  await calculate();
  for (const [id, expected] of [['a', a], ['b', b]] as const) {
    for (const key of ['horizontalMeters', 'ascentMeters', 'descentMeters', 'maxSlopeDeg', 'terrainMeters', 'totalCost'] as const) expect(await metric(`${id}-${key}`)).toBeCloseTo(expected.metrics[key], 8);
    expect(await page.getByTestId('mars-map').getAttribute(`data-route-${id}-nodes`)).toBe(String(expected.cells.length));
  }
  expect(await page.getByTestId('elevation-profile').getAttribute('data-profile-distance')).toBe(String(b.metrics.horizontalMeters));
  expect(await page.getByTestId('elevation-profile').getAttribute('data-profile-points')).toBe(String(b.cells.length));
  evidence.routes = { a: await exportAndAudit('a', a), b: await exportAndAudit('b', b) };
  const frames = await page.evaluate(() => { const o = (window as unknown as { interfaceFrames: { frames: number; activeFrames: number; gaps: number[]; done: boolean } }).interfaceFrames; o.done = true; return { frames: o.frames, activeFrames: o.activeFrames, maxActiveGapMs: o.gaps.length ? Math.max(...o.gaps) : null }; });
  expect(frames.activeFrames).toBeGreaterThan(0); evidence.responsiveness = frames;
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Hide Route A', exact: true }).click();
  expect(await page.getByRole('button', { name: 'Show Route A', exact: true }).getAttribute('aria-pressed')).toBe('false');
  await page.getByRole('button', { name: 'Show Route A', exact: true }).click();
  const alignment: { stage: string; errorPixels: number }[] = [];
  alignment.push({ stage: 'initial', errorPixels: await markerError(start, 'origin') });
  const oldRes = await page.getByTestId('mars-map').getAttribute('data-resolution');
  await page.getByRole('button', { name: 'Zoom in map' }).click();
  await expect.poll(() => page.getByTestId('mars-map').getAttribute('data-resolution')).not.toBe(oldRes);
  alignment.push({ stage: 'zoom', errorPixels: await markerError(start, 'origin') });
  const box = (await page.getByTestId('mars-map').boundingBox())!;
  const oldX = await page.getByTestId('mars-map').getAttribute('data-center-x');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 32, { steps: 10 }); await page.mouse.up();
  await expect.poll(() => page.getByTestId('mars-map').getAttribute('data-center-x')).not.toBe(oldX);
  await page.waitForTimeout(400); alignment.push({ stage: 'pan', errorPixels: await markerError(start, 'origin') });
  for (const name of ['Hillshade', 'Elevation', 'Slope', 'Orthoimage']) {
    await page.getByRole('radio', { name, exact: true }).click(); await page.waitForTimeout(100);
    alignment.push({ stage: name, errorPixels: await markerError(start, 'origin') });
  }
  expect(alignment.every(x => x.errorPixels < 1.1), JSON.stringify(alignment)).toBe(true);
  evidence.alignment = alignment;
});

it('recalculates changed endpoints and lambda using new worker metrics', async () => {
  await ready(); await page.getByRole('button', { name: 'Load validated example' }).click(); await calculate();
  const previous = await metric('a-horizontalMeters');
  const original = expectedRoute(start, goal, 0), newGoal = cellOf(grid, original.cells[160]!);
  await pick(newGoal, 'destination'); expect(await page.getByTestId('a-horizontalMeters').getAttribute('data-value')).toBe('');
  await calculate(); const expected = expectedRoute(start, newGoal, 0);
  expect(await metric('a-horizontalMeters')).toBeCloseTo(expected.metrics.horizontalMeters, 8);
  expect(await metric('a-horizontalMeters')).not.toBe(previous);
  await page.getByRole('slider', { name: 'Route B lambda' }).fill('8');
  expect(await page.getByTestId('b-totalCost').getAttribute('data-value')).toBe('');
  await calculate(); const weighted = expectedRoute(start, newGoal, 8);
  expect(await metric('b-totalCost')).toBeCloseTo(weighted.metrics.totalCost, 8);
  evidence.changedQuery = { start, goal: newGoal, oldHorizontalMeters: previous, newHorizontalMeters: expected.metrics.horizontalMeters, lambda: 8, weightedCost: weighted.metrics.totalCost };
});

it('rejects NoData, steep and outside clicks without moving the selected origin', async () => {
  await ready(); await page.getByRole('button', { name: 'Load validated example' }).click();
  const candidates = Array.from({ length: grid.width * grid.height }, (_, i) => i).filter(i => { const c = cellOf(grid, i); return c.col > 40 && c.col < 350 && c.row > 60 && c.row < 310; });
  const invalid = candidates.find(i => grid.valid[i] === 0)!, steep = candidates.find(i => grid.valid[i] === 1 && grid.slope[i]! > 15)!;
  const rejected: { reason: string; xy: XY; notice: string }[] = [];
  for (const [reason, xy] of [['NoData', cellCenter(grid, cellOf(grid, invalid))], ['slope', cellCenter(grid, cellOf(grid, steep))], ['outside', { x: -2200, y: 1093800 }]] as const) {
    await page.getByRole('button', { name: 'Select origin' }).click(); const p = await pixel(xy); await page.mouse.click(p.x, p.y);
    const alert = page.locator('.mission-notice[role="alert"]');
    await expect.poll(() => alert.innerText()).toMatch(reason === 'NoData' ? /has no valid planning data/ : reason === 'slope' ? /above the/ : /outside the mapped region/);
    expect(await page.getByTestId('mars-map').getAttribute('data-origin-cell')).toBe(JSON.stringify(start));
    rejected.push({ reason, xy, notice: await alert.innerText() });
  }
  evidence.rejectedClicks = rejected;
});

it('terminates active UI workers, ignores stale results and recreates workers for a new calculation', async () => {
  await ready(); await page.getByRole('button', { name: 'Load validated example' }).click();
  const lifecycle: string[] = []; page.on('worker', w => { lifecycle.push('created'); w.on('close', () => lifecycle.push('closed')); });
  const created = new Promise<void>(resolve => {
    const listener = () => { if (page.workers().length === 2) { page.off('worker', listener); resolve(); } };
    page.on('worker', listener);
  });
  await page.getByRole('button', { name: 'Calculate routes', exact: true }).click();
  await created;
  // Dispatch the actual DOM control immediately: a real Jezero route can finish before
  // Playwright's two-frame layout-stability wait, so a normal auto-wait click races completion.
  await page.getByRole('button', { name: 'Cancel calculation', exact: true }).dispatchEvent('click');
  await expect.poll(() => page.locator('.mission-app').getAttribute('data-calculation-state')).toBe('cancelled');
  await expect.poll(() => lifecycle.filter(x => x === 'closed').length).toBe(2);
  await page.waitForTimeout(600); expect(await page.getByTestId('b-horizontalMeters').getAttribute('data-value')).toBe('');
  await page.getByRole('slider', { name: 'Route B lambda' }).fill('0'); await calculate();
  expect(await metric('a-horizontalMeters')).toBe(await metric('b-horizontalMeters'));
  expect(await metric('a-totalCost')).toBe(await metric('b-totalCost'));
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.waitForTimeout(300);
  expect(await page.locator('.mission-app').getAttribute('data-calculation-state')).toBe('idle');
  expect(await page.getByTestId('mars-map').getAttribute('data-origin-cell')).toBe('');
  expect(await page.getByTestId('b-horizontalMeters').getAttribute('data-value')).toBe('');
  evidence.uiCancellation = { lifecycle, closedBeforeRecalculation: 2, cancelledStateObserved: true, emptyMetricsAfterCancellation: true, recreatedWithLambdaZero: true, resetClearsResults: true, controlEvent: 'Immediate DOM click while workers active; no CPU throttling' };
});

it('provides a working narrow layout and exported map without horizontal overflow', async () => {
  await page.setViewportSize({ width: 390, height: 844 }); await ready();
  await page.getByRole('button', { name: 'Load validated example' }).click(); await calculate();
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByTestId('mars-map').isVisible()).toBe(true);
  expect(await metric('b-horizontalMeters')).toBeCloseTo(expectedRoute().metrics.horizontalMeters, 8);
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  evidence.mobile = { viewport: { width: 390, height: 844 }, noHorizontalOverflow: true, realRoutesComputed: true };
});

it('reports a real disconnected valid destination and clears obsolete paths', async () => {
  const p = normalizeOptions({ mode: 'distance', maxSlopeDeg: 15 });
  const isolated = grid.valid.findIndex((v, i) => {
    const c = cellOf(grid, i);
    if (v !== 1 || grid.slope[i]! > 15 || c.col < 40 || c.col > 350 || c.row < 60 || c.row > 310) return false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if ((dc || dr) && evaluateEdge(grid, i, (c.row + dr) * grid.width + c.col + dc, p)) return false;
    }
    return true;
  });
  expect(isolated).toBeGreaterThan(-1); const unreachable = cellOf(grid, isolated);
  expect(planRoute(grid, start, unreachable, { mode: 'distance' }).status).toBe('no-route');
  await ready(); await page.getByRole('button', { name: 'Load validated example' }).click(); await calculate();
  await pick(unreachable, 'destination');
  await page.getByRole('button', { name: 'Calculate routes', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-calculation-state="no-route"]'));
  expect(await page.locator('.mission-notice[role="alert"]').innerText()).toContain('No route exists');
  expect(await page.getByTestId('mars-map').getAttribute('data-route-a-nodes')).toBe('0');
  expect(await page.getByTestId('b-horizontalMeters').getAttribute('data-value')).toBe('');
  await page.screenshot({ path: `${output}/no-route.png`, fullPage: true });
  evidence.noRoute = { start, goal: unreachable, destinationElevationMeters: grid.elevation[isolated], destinationSlopeDeg: grid.slope[isolated], validMask: grid.valid[isolated], explicitNoRouteState: true };
});

it('blocks initialization when a scientific binary is truncated instead of presenting usable terrain', async () => {
  // Deliberately damaged HTTP response is a test fixture, never written to scientific assets.
  await page.route('**/routing_valid.u8', r => r.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.from([0]) }));
  await page.goto(base); await page.getByText('Could not verify the data', { exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Calculate routes', exact: true }).isDisabled()).toBe(true);
  expect(await page.getByTestId('mars-map').count()).toBe(0);
  evidence.corruptResponse = { explicitlySyntheticHTTPFixture: true, rejectedBeforeMapCreation: true, calculationDisabled: true };
});

async function scienceReady() {
  await ready(); await page.waitForFunction(() => document.querySelector('[data-science-ready="true"]'));
}
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  it(`runs the guided validated mission end to end at ${viewport.width}px with real exports and regional context`, async () => {
    await mkdir('docs/jury-improvement', { recursive: true });
    await page.setViewportSize(viewport); const readyBegan = performance.now(); await scienceReady();
    await page.waitForSelector('[data-overview-ready="true"]');
    const readyMs = performance.now() - readyBegan;
    const objectives = JSON.parse(await readFile('public/data/jezero-science-v1/objectives.json', 'utf8')).objectives as ScienceObjective[];
    const missionGoal = objectives.find(o => o.id === 'meowrtian-njf')!.cell;
    const initialResolution = Number(await page.getByTestId('mars-map').getAttribute('data-resolution'));
    await page.getByRole('button', { name: 'Zoom in map', exact: true }).click();
    await expect.poll(async () => Number(await page.getByTestId('mars-map').getAttribute('data-resolution'))).toBeLessThan(initialResolution);
    await page.getByRole('radio', { name: 'Slope', exact: true }).click();
    await page.getByLabel('Slope limit', { exact: true }).selectOption('5');
    await page.getByLabel('Route B lambda', { exact: true }).evaluate((el: HTMLInputElement) => { el.value = '8'; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); });
    const demoBegan = performance.now(); await page.getByRole('button', { name: /Start Mission/ }).click();
    await page.waitForSelector('[data-demo-state="complete"]');
    const demoRoundTripMs = performance.now() - demoBegan;
    expect(await page.getByTestId('mars-map').getAttribute('data-origin-cell')).toBe(JSON.stringify(start));
    expect(await page.getByTestId('mars-map').getAttribute('data-destination-cell')).toBe(JSON.stringify(missionGoal));
    expect(await page.getByLabel('Slope limit', { exact: true }).inputValue()).toBe('15');
    expect(await page.getByLabel('Route B lambda', { exact: true }).inputValue()).toBe('4');
    expect(await page.getByRole('radio', { name: 'Orthoimage', exact: true }).getAttribute('aria-checked')).toBe('true');
    await expect.poll(async () => Number(await page.getByTestId('mars-map').getAttribute('data-resolution'))).toBeCloseTo(initialResolution, 5);
    const a = expectedRoute(start, missionGoal, 0), b = expectedRoute(start, missionGoal, 4);
    expect(await page.getByTestId('route-insight').innerText()).toContain(compareRoutes(a, b));
    const routeExports = [];
    for (const [id, route] of [['a', a], ['b', b]] as const) {
      for (const key of ['horizontalMeters', 'terrainMeters', 'ascentMeters', 'descentMeters', 'maxSlopeDeg'] as const) expect(await metric(`${id}-${key}`)).toBeCloseTo(route.metrics[key], 7);
      expect(await metric(`${id}-computeTimeMs`)).toBeGreaterThanOrEqual(0);
      const exported = await exportAndAudit(id, route);
      const file = `docs/jury-improvement/${viewport.width}-route-${id}.json`;
      await writeFile(file, await readFile(exported.file)); routeExports.push({ ...exported, file });
    }
    const overview = page.getByTestId('regional-overview');
    if (await overview.getByRole('button', { name: 'JEZERO / CONTEXT' }).getAttribute('aria-expanded') === 'false') await overview.getByRole('button', { name: 'JEZERO / CONTEXT' }).click();
    expect(await overview.locator('svg[role="img"]').getAttribute('data-study-extent')).toBe(JSON.stringify([-1968, 1091838, 1968, 1095398]));
    expect(await overview.locator('svg[role="img"] path').count()).toBeGreaterThan(37);
    await overview.getByRole('button', { name: 'Return to study area' }).click();
    await mkdir('docs/jury-improvement', { recursive: true });
    const icon = await overview.locator('.overview-recenter svg').boundingBox();
    expect(icon!.width).toBeLessThanOrEqual(16); expect(icon!.height).toBeLessThanOrEqual(16);
    const frame = await overview.boundingBox(), mapFrame = await page.locator('.map-stage').boundingBox();
    expect(frame!.height).toBeLessThan(mapFrame!.height - 45);
    const tools = await page.locator('.map-tools').boundingBox();
    expect(frame!.x + frame!.width).toBeLessThan(tools!.x - 2);
    await overview.screenshot({ path: `docs/jury-improvement/context-${viewport.width}.png` });
    if (viewport.width <= 760) await overview.getByRole('button', { name: 'JEZERO / CONTEXT' }).click();
    await page.locator('#route-comparison').screenshot({ path: `docs/jury-improvement/comparison-${viewport.width}.png` });
    await page.getByRole('button', { name: 'View routes on terrain' }).click();
    await page.waitForFunction(() => { const r = document.querySelector('.map-stage')!.getBoundingClientRect(); return Math.abs(r.top + r.height / 2 - innerHeight / 2) < 2; });
    await page.locator('.map-stage').screenshot({ path: `docs/jury-improvement/map-${viewport.width}.png` });
    await page.screenshot({ path: `docs/jury-improvement/after-${viewport.width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const scenarios = evidence.juryMissions as unknown[] ?? []; evidence.juryMissions = scenarios;
    await page.getByRole('button', { name: /03 \/ Inspect M1/ }).click();
    const card = page.getByTestId('science-inspector'); await card.waitFor();
    expect(await card.innerText()).toContain('TEAM-SELECTED SCIENCE OBJECTIVE');
    expect(await card.innerText()).toContain('Scientific objective'); expect(await card.innerText()).toContain('100–200 m');
    await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: `docs/jury-improvement/objective-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Close science card' }).click();
    scenarios.push({ viewport, start, goal: missionGoal, parameters: { maxSlopeDeg: 15, lambdaA: 0, lambdaB: 4 }, routeA: a.metrics, routeB: b.metrics,
      readyMs, demoRoundTripMs, routeExports, computeTimeMs: { a: await metric('a-computeTimeMs'), b: await metric('b-computeTimeMs') }, overviewLoaded: true, sourceAssetRequestsOnly: true });
  });
}
it('keeps the real planner usable if the optional regional-context response is corrupted', async () => {
  await page.route('**/jezero-overview-v1/context.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await scienceReady();
  await page.getByText('Context unavailable. The HiRISE planner remains usable.', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Start Mission/ }).click();
  await page.waitForSelector('[data-demo-state="complete"]');
  const objectives = JSON.parse(await readFile('public/data/jezero-science-v1/objectives.json', 'utf8')).objectives as ScienceObjective[];
  expect(await metric('b-horizontalMeters')).toBeCloseTo(expectedRoute(start, objectives.find(o => o.id === 'meowrtian-njf')!.cell).metrics.horizontalMeters, 7);
});
it('positions the USGS layer in local coordinates, queries real polygons and leaves route metrics unchanged', async () => {
  await scienceReady(); await page.getByRole('button', { name: 'Load validated example' }).click(); await calculate();
  const previous = await metric('b-totalCost');
  await page.getByRole('checkbox', { name: 'USGS geology SIM 3464' }).check();
  expect(await page.getByTestId('mars-map').getAttribute('data-geology-features')).toBe('6');
  const objectives = JSON.parse(await readFile('public/data/jezero-science-v1/objectives.json', 'utf8')).objectives as ScienceObjective[];
  const nle = objectives.find(o => o.unitSymbol === 'Nle')!;
  // Away from the M2 marker AND its clickable text label, inside its >550 m unit margin.
  const projected = { x: nle.xy[0] + 200, y: nle.xy[1] + 150 }, p = await pixel(projected);
  await page.mouse.click(p.x, p.y);
  const card = page.getByTestId('science-inspector');
  await expect.poll(() => card.getAttribute('data-selection-kind')).toBe('unit');
  expect(await card.innerText()).toContain('Lower etched unit'); expect(await card.innerText()).toContain(`OBJECTID ${nle.sourceFid}`);
  expect(await card.innerText()).toContain('100–200 m');
  expect(await metric('b-totalCost')).toBe(previous);
  await page.screenshot({ path: 'docs/science-validation/geology-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Close science card' }).click();
  await page.getByRole('checkbox', { name: 'USGS geology SIM 3464' }).uncheck();
  expect(await metric('b-totalCost')).toBe(previous);
  evidence.geology = { clickedProjectedXY: projected, queriedSourceFid: nle.sourceFid, unit: nle.unitSymbol, features: 6, unchangedCostWhenTogglingLayer: previous, warningVisible: true };
});

it('opens all three real objective markers and uses a documented target as the route destination', async () => {
  await scienceReady(); await page.getByRole('button', { name: 'Load validated example' }).click();
  const objectives = JSON.parse(await readFile('public/data/jezero-science-v1/objectives.json', 'utf8')).objectives as ScienceObjective[];
  for (const objective of objectives) {
    const p = await pixel({ x: objective.xy[0], y: objective.xy[1] }); await page.mouse.click(p.x, p.y);
    const card = page.getByTestId('science-inspector');
    await expect.poll(() => card.getAttribute('data-selection-kind')).toBe('objective');
    await expect.poll(() => card.innerText()).toContain(objective.id);
    expect(await card.innerText()).toContain(objective.unitName);
    expect(await card.innerText()).toContain('not an official NASA/USGS name or station');
    await card.getByText('Objective sources', { exact: true }).click();
    await assertEnglishUI(page);
    await page.getByRole('button', { name: 'Close science card' }).click();
  }
  await page.getByRole('button', { name: 'Inspect objective M3' }).click();
  await page.getByRole('button', { name: 'Use as destination', exact: true }).click();
  const target = objectives[2]!;
  expect(await page.getByTestId('mars-map').getAttribute('data-destination-cell')).toBe(JSON.stringify(target.cell));
  await calculate(); const expected = expectedRoute(start, target.cell, 4);
  expect(await metric('b-horizontalMeters')).toBeCloseTo(expected.metrics.horizontalMeters, 8);
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await pending; await download.saveAs('docs/science-validation/scientific-route-b.json');
  const exported = JSON.parse(await readFile('docs/science-validation/scientific-route-b.json', 'utf8'));
  expect(auditRoute(grid, exported).passed).toBe(true);
  expect(exported.scientificContext.endpointCellAssociations[0].id).toBe(target.id);
  expect(exported.scientificContext.geologyUse).toContain('excluded');
  expect(exported.scientificContext.registration.warningEn).toContain('100–200 m');
  expect(exported.scientificContext.registration.warningEn).toContain('Reprojection does not correct');
  expect(exported.scientificContext.endpointCellAssociations[0].designationEn).toContain('not an official NASA/USGS name or station');
  expect(exported.scientificContext.registration.documentedOffsetMeters).toEqual([100, 200]);
  evidence.scienceObjectives = { markersQueriedAtExactCoordinates: objectives.map(x => x.id), destination: target.cell, computedMetrics: exported.metrics, independentAudit: auditRoute(grid, exported), exportIncludesUncertainty: true };
});

it('loads authentic NASA photo cards with same-sol RMC provenance and a real image in narrow layout', async () => {
  await scienceReady(); await page.getByRole('checkbox', { name: 'Perseverance photographs' }).check();
  const photos = JSON.parse(await readFile('public/data/jezero-science-v1/photos.json', 'utf8')).photos as DocumentedPhoto[];
  const checked = [];
  for (const photo of photos) {
    await page.getByRole('button', { name: `${photo.label} RMC ${photo.rmc}`, exact: false }).click();
    const card = page.getByTestId('science-inspector');
    await expect.poll(() => card.getAttribute('data-selection-kind')).toBe('photo');
    await page.waitForFunction(() => { const img = document.querySelector('.science-inspector img') as HTMLImageElement | null; return !!img && img.complete && img.naturalWidth > 0; });
    expect(await card.innerText()).toContain(photo.credit); expect(await card.innerText()).toContain(photo.rmc);
    expect(await card.innerText()).toContain('not the location of the photographed terrain');
    expect(await card.locator('time').getAttribute('dateTime')).toBe(photo.utc);
    const response = await page.request.get(base + '/data/jezero-science-v1/' + photo.file);
    expect(response.headers()['content-type']).toBe('image/jpeg');
    checked.push({ id: photo.imageId, rmc: photo.rmc, utc: photo.utc, sourcePage: photo.sourcePageUrl });
    if (photo.sol === 107) await page.screenshot({ path: 'docs/science-validation/perseverance-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Close science card' }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Inspect objective M2' }).click();
  await page.waitForTimeout(600); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/science-validation/science-mobile.png', fullPage: true });
  evidence.photos = { authenticImagesLoaded: checked, noGroundTargetsInferred: true, narrowScienceCardWithoutOverflow: true };
});

it('rejects a corrupted science layer while preserving the functional HiRISE route planner', async () => {
  // Synthetic HTTP error fixture, never written to downloaded or prepared science files.
  await page.route('**/jezero-science-v1/geology.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ready(); await page.locator('.science-controls[role="alert"], .science-controls [role="alert"]').waitFor();
  expect(await page.getByRole('checkbox', { name: 'USGS geology SIM 3464' }).count()).toBe(0);
  await page.getByRole('button', { name: 'Load validated example' }).click(); await calculate();
  expect(await metric('b-totalCost')).toBeCloseTo(expectedRoute().metrics.totalCost, 8);
  evidence.corruptScience = { syntheticHTTPFixture: true, integrityErrorVisible: true, originalPlannerStillComputes: true };
});
