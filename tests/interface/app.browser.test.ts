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
  await page.getByText('HiRISE verificado', { exact: true }).waitFor();
}
async function calculate() {
  await page.getByRole('button', { name: 'Calcular rutas', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-calculation-state="complete"]'));
}
async function pixel(xy: XY) {
  const map = page.getByTestId('mars-map'), box = await map.boundingBox();
  if (!box) throw new Error('Missing map geometry');
  const cx = Number(await map.getAttribute('data-center-x')), cy = Number(await map.getAttribute('data-center-y')), res = Number(await map.getAttribute('data-resolution'));
  return { x: box.x + box.width / 2 + (xy.x - cx) / res, y: box.y + box.height / 2 + (cy - xy.y) / res };
}
async function pick(cell: Cell, kind: 'origen' | 'destino') {
  await page.getByRole('button', { name: `Seleccionar ${kind}`, exact: true }).click();
  const p = await pixel(cellCenter(grid, cell)); await page.mouse.click(p.x, p.y);
  const attr = kind === 'origen' ? 'data-origin-cell' : 'data-destination-cell';
  await expect.poll(() => page.getByTestId('mars-map').getAttribute(attr)).toBe(JSON.stringify(cell));
}
async function markerError(cell: Cell, kind: 'origen' | 'destino') {
  const screen = await pixel(cellCenter(grid, cell));
  const box = await page.getByRole('img', { name: `Marcador ${kind}`, exact: true }).boundingBox();
  if (!box) throw new Error('Missing marker');
  return Math.hypot(box.x + box.width / 2 - screen.x, box.y + box.height / 2 - screen.y);
}
async function metric(id: string) { return Number(await page.getByTestId(id).getAttribute('data-value')); }
async function exportAndAudit(id: 'a' | 'b', expected: RouteSuccess) {
  await page.getByRole('button', { name: `Ver perfil ruta ${id.toUpperCase()}` }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON' }).click();
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
  for (const [name, file] of [['Ortoimagen', 'ortho'], ['Relieve', 'hillshade'], ['Elevación', 'elevation'], ['Pendiente', 'slope']]) {
    await page.getByRole('radio', { name: name!, exact: true }).click();
    await page.waitForFunction(file => performance.getEntriesByType('resource').some(x => x.name.endsWith(`/${file}.webp`)), file!);
    await page.waitForTimeout(200); // image decode/render, not route timing
    const data = await map.locator('canvas').first().evaluate((c: HTMLCanvasElement) => c.toDataURL());
    canvasHashes.push((await import('node:crypto')).createHash('sha256').update(data).digest('hex'));
    await map.screenshot({ path: `${output}/layer-${file}.png` });
  }
  expect(new Set(canvasHashes).size).toBe(4);
  await page.getByRole('button', { name: 'Procedencia y resolución' }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor({ state: 'visible' });
  expect(await dialog.innerText()).toContain('jezero-hirise-v1');
  expect(await dialog.innerText()).toContain('4 m visual');
  await dialog.locator('summary').click(); expect(await dialog.innerText()).toContain(grid.dataset.manifestSha256);
  expect(await dialog.locator('a[href*="uahirise.org"]').count()).toBe(3);
  expect(await dialog.locator('a[href="https://doi.org/10.3133/sim3464"]').count()).toBe(1);
  await page.screenshot({ path: `${output}/sources.png`, fullPage: true });
  await page.getByRole('button', { name: 'Cerrar fuentes' }).click();
  evidence.map = { fourDistinctRenderedLayers: true, canvasHashes, noExternalRequests: true, localMetricScale: await page.locator('.mars-scale-inner').innerText(), provenanceDialogChecked: true };
});

it('turns actual map clicks into real routes, audits downloaded JSON and stays aligned through zoom/pan/layers', async () => {
  await ready(); await pick(start, 'origen'); await pick(goal, 'destino');
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
  await page.getByRole('button', { name: 'Ocultar ruta A', exact: true }).click();
  expect(await page.getByRole('button', { name: 'Mostrar ruta A', exact: true }).getAttribute('aria-pressed')).toBe('false');
  await page.getByRole('button', { name: 'Mostrar ruta A', exact: true }).click();
  const alignment: { stage: string; errorPixels: number }[] = [];
  alignment.push({ stage: 'initial', errorPixels: await markerError(start, 'origen') });
  const oldRes = await page.getByTestId('mars-map').getAttribute('data-resolution');
  await page.getByRole('button', { name: 'Acercar mapa' }).click();
  await expect.poll(() => page.getByTestId('mars-map').getAttribute('data-resolution')).not.toBe(oldRes);
  alignment.push({ stage: 'zoom', errorPixels: await markerError(start, 'origen') });
  const box = (await page.getByTestId('mars-map').boundingBox())!;
  const oldX = await page.getByTestId('mars-map').getAttribute('data-center-x');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 32, { steps: 10 }); await page.mouse.up();
  await expect.poll(() => page.getByTestId('mars-map').getAttribute('data-center-x')).not.toBe(oldX);
  await page.waitForTimeout(400); alignment.push({ stage: 'pan', errorPixels: await markerError(start, 'origen') });
  for (const name of ['Relieve', 'Elevación', 'Pendiente', 'Ortoimagen']) {
    await page.getByRole('radio', { name, exact: true }).click(); await page.waitForTimeout(100);
    alignment.push({ stage: name, errorPixels: await markerError(start, 'origen') });
  }
  expect(alignment.every(x => x.errorPixels < 1.1), JSON.stringify(alignment)).toBe(true);
  evidence.alignment = alignment;
});

it('recalculates changed endpoints and lambda using new worker metrics', async () => {
  await ready(); await page.getByRole('button', { name: 'Usar ejemplo validado' }).click(); await calculate();
  const previous = await metric('a-horizontalMeters');
  const original = expectedRoute(start, goal, 0), newGoal = cellOf(grid, original.cells[160]!);
  await pick(newGoal, 'destino'); expect(await page.getByTestId('a-horizontalMeters').getAttribute('data-value')).toBe('');
  await calculate(); const expected = expectedRoute(start, newGoal, 0);
  expect(await metric('a-horizontalMeters')).toBeCloseTo(expected.metrics.horizontalMeters, 8);
  expect(await metric('a-horizontalMeters')).not.toBe(previous);
  await page.getByRole('slider', { name: 'Lambda de la ruta B' }).fill('8');
  expect(await page.getByTestId('b-totalCost').getAttribute('data-value')).toBe('');
  await calculate(); const weighted = expectedRoute(start, newGoal, 8);
  expect(await metric('b-totalCost')).toBeCloseTo(weighted.metrics.totalCost, 8);
  evidence.changedQuery = { start, goal: newGoal, oldHorizontalMeters: previous, newHorizontalMeters: expected.metrics.horizontalMeters, lambda: 8, weightedCost: weighted.metrics.totalCost };
});

it('rejects NoData, steep and outside clicks without moving the selected origin', async () => {
  await ready(); await page.getByRole('button', { name: 'Usar ejemplo validado' }).click();
  const candidates = Array.from({ length: grid.width * grid.height }, (_, i) => i).filter(i => { const c = cellOf(grid, i); return c.col > 40 && c.col < 350 && c.row > 60 && c.row < 310; });
  const invalid = candidates.find(i => grid.valid[i] === 0)!, steep = candidates.find(i => grid.valid[i] === 1 && grid.slope[i]! > 15)!;
  const rejected: { reason: string; xy: XY; notice: string }[] = [];
  for (const [reason, xy] of [['NoData', cellCenter(grid, cellOf(grid, invalid))], ['slope', cellCenter(grid, cellOf(grid, steep))], ['outside', { x: -2200, y: 1093800 }]] as const) {
    await page.getByRole('button', { name: 'Seleccionar origen' }).click(); const p = await pixel(xy); await page.mouse.click(p.x, p.y);
    const alert = page.locator('.mission-notice[role="alert"]');
    await expect.poll(() => alert.innerText()).toMatch(reason === 'NoData' ? /no tiene datos válidos/ : reason === 'slope' ? /superior al límite/ : /fuera de la región/);
    expect(await page.getByTestId('mars-map').getAttribute('data-origin-cell')).toBe(JSON.stringify(start));
    rejected.push({ reason, xy, notice: await alert.innerText() });
  }
  evidence.rejectedClicks = rejected;
});

it('terminates active UI workers, ignores stale results and recreates workers for a new calculation', async () => {
  await ready(); await page.getByRole('button', { name: 'Usar ejemplo validado' }).click();
  const lifecycle: string[] = []; page.on('worker', w => { lifecycle.push('created'); w.on('close', () => lifecycle.push('closed')); });
  const created = new Promise<void>(resolve => {
    const listener = () => { if (page.workers().length === 2) { page.off('worker', listener); resolve(); } };
    page.on('worker', listener);
  });
  await page.getByRole('button', { name: 'Calcular rutas', exact: true }).click();
  await created;
  // Dispatch the actual DOM control immediately: a real Jezero route can finish before
  // Playwright's two-frame layout-stability wait, so a normal auto-wait click races completion.
  await page.getByRole('button', { name: 'Cancelar cálculo', exact: true }).dispatchEvent('click');
  await expect.poll(() => page.locator('.mission-app').getAttribute('data-calculation-state')).toBe('cancelled');
  await expect.poll(() => lifecycle.filter(x => x === 'closed').length).toBe(2);
  await page.waitForTimeout(600); expect(await page.getByTestId('b-horizontalMeters').getAttribute('data-value')).toBe('');
  await page.getByRole('slider', { name: 'Lambda de la ruta B' }).fill('0'); await calculate();
  expect(await metric('a-horizontalMeters')).toBe(await metric('b-horizontalMeters'));
  expect(await metric('a-totalCost')).toBe(await metric('b-totalCost'));
  await page.getByRole('button', { name: 'Reiniciar', exact: true }).click();
  await page.waitForTimeout(300);
  expect(await page.locator('.mission-app').getAttribute('data-calculation-state')).toBe('idle');
  expect(await page.getByTestId('mars-map').getAttribute('data-origin-cell')).toBe('');
  expect(await page.getByTestId('b-horizontalMeters').getAttribute('data-value')).toBe('');
  evidence.uiCancellation = { lifecycle, closedBeforeRecalculation: 2, cancelledStateObserved: true, emptyMetricsAfterCancellation: true, recreatedWithLambdaZero: true, resetClearsResults: true, controlEvent: 'Immediate DOM click while workers active; no CPU throttling' };
});

it('provides a working narrow layout and exported map without horizontal overflow', async () => {
  await page.setViewportSize({ width: 390, height: 844 }); await ready();
  await page.getByRole('button', { name: 'Usar ejemplo validado' }).click(); await calculate();
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
  await ready(); await page.getByRole('button', { name: 'Usar ejemplo validado' }).click(); await calculate();
  await pick(unreachable, 'destino');
  await page.getByRole('button', { name: 'Calcular rutas', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-calculation-state="no-route"]'));
  expect(await page.locator('.mission-notice[role="alert"]').innerText()).toContain('No existe una ruta');
  expect(await page.getByTestId('mars-map').getAttribute('data-route-a-nodes')).toBe('0');
  expect(await page.getByTestId('b-horizontalMeters').getAttribute('data-value')).toBe('');
  await page.screenshot({ path: `${output}/no-route.png`, fullPage: true });
  evidence.noRoute = { start, goal: unreachable, destinationElevationMeters: grid.elevation[isolated], destinationSlopeDeg: grid.slope[isolated], validMask: grid.valid[isolated], explicitNoRouteState: true };
});

it('blocks initialization when a scientific binary is truncated instead of presenting usable terrain', async () => {
  // Deliberately damaged HTTP response is a test fixture, never written to scientific assets.
  await page.route('**/routing_valid.u8', r => r.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.from([0]) }));
  await page.goto(base); await page.getByText('No se pudieron verificar los datos', { exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Calcular rutas', exact: true }).isDisabled()).toBe(true);
  expect(await page.getByTestId('mars-map').count()).toBe(0);
  evidence.corruptResponse = { explicitlySyntheticHTTPFixture: true, rejectedBeforeMapCreation: true, calculationDisabled: true };
});

async function scienceReady() {
  await ready(); await page.waitForFunction(() => document.querySelector('[data-science-ready="true"]'));
}
it('positions the USGS layer in local coordinates, queries real polygons and leaves route metrics unchanged', async () => {
  await scienceReady(); await page.getByRole('button', { name: 'Usar ejemplo validado' }).click(); await calculate();
  const previous = await metric('b-totalCost');
  await page.getByRole('checkbox', { name: 'Geología USGS SIM 3464' }).check();
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
  await page.getByRole('button', { name: 'Cerrar ficha científica' }).click();
  await page.getByRole('checkbox', { name: 'Geología USGS SIM 3464' }).uncheck();
  expect(await metric('b-totalCost')).toBe(previous);
  evidence.geology = { clickedProjectedXY: projected, queriedSourceFid: nle.sourceFid, unit: nle.unitSymbol, features: 6, unchangedCostWhenTogglingLayer: previous, warningVisible: true };
});

it('opens all three real objective markers and uses a documented target as the route destination', async () => {
  await scienceReady(); await page.getByRole('button', { name: 'Usar ejemplo validado' }).click();
  const objectives = JSON.parse(await readFile('public/data/jezero-science-v1/objectives.json', 'utf8')).objectives as ScienceObjective[];
  for (const objective of objectives) {
    const p = await pixel({ x: objective.xy[0], y: objective.xy[1] }); await page.mouse.click(p.x, p.y);
    const card = page.getByTestId('science-inspector');
    await expect.poll(() => card.getAttribute('data-selection-kind')).toBe('objective');
    await expect.poll(() => card.innerText()).toContain(objective.label);
    expect(await card.innerText()).toContain(objective.unitName);
    expect(await card.innerText()).toContain('no es nombre ni estación oficial');
    await page.getByRole('button', { name: 'Cerrar ficha científica' }).click();
  }
  await page.getByRole('button', { name: 'Consultar objetivo M3' }).click();
  await page.getByRole('button', { name: 'Usar como destino', exact: true }).click();
  const target = objectives[2]!;
  expect(await page.getByTestId('mars-map').getAttribute('data-destination-cell')).toBe(JSON.stringify(target.cell));
  await calculate(); const expected = expectedRoute(start, target.cell, 4);
  expect(await metric('b-horizontalMeters')).toBeCloseTo(expected.metrics.horizontalMeters, 8);
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar JSON' }).click();
  const download = await pending; await download.saveAs('docs/science-validation/scientific-route-b.json');
  const exported = JSON.parse(await readFile('docs/science-validation/scientific-route-b.json', 'utf8'));
  expect(auditRoute(grid, exported).passed).toBe(true);
  expect(exported.scientificContext.endpointCellAssociations[0].id).toBe(target.id);
  expect(exported.scientificContext.geologyUse).toContain('excluded');
  expect(exported.scientificContext.registration.documentedOffsetMeters).toEqual([100, 200]);
  evidence.scienceObjectives = { markersQueriedAtExactCoordinates: objectives.map(x => x.id), destination: target.cell, computedMetrics: exported.metrics, independentAudit: auditRoute(grid, exported), exportIncludesUncertainty: true };
});

it('loads authentic NASA photo cards with same-sol RMC provenance and a real image in narrow layout', async () => {
  await scienceReady(); await page.getByRole('checkbox', { name: 'Fotografías Perseverance' }).check();
  const photos = JSON.parse(await readFile('public/data/jezero-science-v1/photos.json', 'utf8')).photos as DocumentedPhoto[];
  const checked = [];
  for (const photo of photos) {
    await page.getByRole('button', { name: `${photo.label} RMC ${photo.rmc}`, exact: false }).click();
    const card = page.getByTestId('science-inspector');
    await expect.poll(() => card.getAttribute('data-selection-kind')).toBe('photo');
    await page.waitForFunction(() => { const img = document.querySelector('.science-inspector img') as HTMLImageElement | null; return !!img && img.complete && img.naturalWidth > 0; });
    expect(await card.innerText()).toContain(photo.credit); expect(await card.innerText()).toContain(photo.rmc);
    expect(await card.innerText()).toContain('no es la posición del terreno fotografiado');
    expect(await card.locator('time').getAttribute('dateTime')).toBe(photo.utc);
    const response = await page.request.get(base + '/data/jezero-science-v1/' + photo.file);
    expect(response.headers()['content-type']).toBe('image/jpeg');
    checked.push({ id: photo.imageId, rmc: photo.rmc, utc: photo.utc, sourcePage: photo.sourcePageUrl });
    if (photo.sol === 107) await page.screenshot({ path: 'docs/science-validation/perseverance-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Cerrar ficha científica' }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Consultar objetivo M2' }).click();
  await page.waitForTimeout(600); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/science-validation/science-mobile.png', fullPage: true });
  evidence.photos = { authenticImagesLoaded: checked, noGroundTargetsInferred: true, narrowScienceCardWithoutOverflow: true };
});

it('rejects a corrupted science layer while preserving the functional HiRISE route planner', async () => {
  // Synthetic HTTP error fixture, never written to downloaded or prepared science files.
  await page.route('**/jezero-science-v1/geology.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ready(); await page.locator('.science-controls[role="alert"], .science-controls [role="alert"]').waitFor();
  expect(await page.getByRole('checkbox', { name: 'Geología USGS SIM 3464' }).count()).toBe(0);
  await page.getByRole('button', { name: 'Usar ejemplo validado' }).click(); await calculate();
  expect(await metric('b-totalCost')).toBeCloseTo(expectedRoute().metrics.totalCost, 8);
  evidence.corruptScience = { syntheticHTTPFixture: true, integrityErrorVisible: true, originalPlannerStillComputes: true };
});
