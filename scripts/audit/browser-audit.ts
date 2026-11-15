import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright-core';
import type { Page } from 'playwright-core';
import { startStaticServer } from '../web/serve-static.mjs';
import { loadLocalGrid } from '../routing/local-data.js';
import { planRoute } from '../../lib/routing/engine.js';
import { auditRoute } from '../routing/independent-audit.js';
import { cellCenter } from '../../lib/routing/grid.js';
import type { RouteSuccess } from '../../lib/routing/types.js';
import type { ScienceObjective, DocumentedPhoto } from '../../lib/science/model.js';
import { verifyHostedContent } from './hosted-content.mjs';
import { compareRoutes } from '../../lib/map/route-comparison.js';

const dir = process.env.MARS_AUDIT_OUTPUT || 'docs/final-audit'; await mkdir(dir, { recursive: true });
const security = JSON.parse(await readFile(`${dir}/antivirus.json`, 'utf8'));
assert.equal(security.reviewRequired, false, 'STOP: unresolved security review');
assert.equal(security.projectRelatedDetectionCount, 0, 'STOP: antivirus detection requires review');
assert.ok(Date.now() - Date.parse(security.checkedAtUtc) < 30 * 60 * 1000, 'Repeat antivirus inspection before running');
const { grid } = await loadLocalGrid();
const objectives = JSON.parse(await readFile('public/data/jezero-science-v1/objectives.json', 'utf8')).objectives as ScienceObjective[];
const photos = JSON.parse(await readFile('public/data/jezero-science-v1/photos.json', 'utf8')).photos as DocumentedPhoto[];
const demo = JSON.parse(await readFile('public/data/jezero-hirise-v1/demo-query.json', 'utf8'));
const productionUrl = process.env.MARS_AUDIT_URL;
const siteId: string | undefined = productionUrl ? JSON.parse(await readFile('docs/deployment-validation/deploy.json', 'utf8')).site_id : undefined;
if (productionUrl) assert.equal(new URL(productionUrl).protocol, 'https:', 'Production must use HTTPS');
const server = productionUrl ? null : await startStaticServer({ port: 0 });
const address = server?.address();
if (!productionUrl && (!address || typeof address === 'string')) throw new Error('No local server');
const base = productionUrl ? new URL(productionUrl).origin : `http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`;
const browser = await chromium.launch({ executablePath: process.env.MARS_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report: { executedAtUtc: string; browser: string; source: string; scenarios: Record<string, unknown>[]; staticInventory?: unknown; allPassed?: boolean } = {
  executedAtUtc: new Date().toISOString(), browser: browser.version(), source: `${base}; actual ${productionUrl ? 'public HTTPS deployment' : 'out/ over local HTTP'}; fresh isolated private browser contexts without credentials, cache disabled; no fabricated science`, scenarios: [],
};
async function waitFor(test: () => Promise<boolean>, message: string) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) { if (await test()) return; await new Promise(done => setTimeout(done, 50)); }
  throw new Error(message);
}
async function cardInViewport(page: Page) {
  let previous = '', stable = 0;
  await waitFor(async () => {
    const b = await page.getByTestId('science-inspector').boundingBox();
    const now = b ? `${b.y.toFixed(1)},${b.height.toFixed(1)}` : '';
    stable = now && now === previous ? stable + 1 : 0; previous = now;
    return stable >= 6 && !!b && b.y >= 0 && b.y + b.height <= page.viewportSize()!.height + 1;
  }, 'Scientific card outside actual visible viewport after scrolling settles');
}
async function pixel(page: Page, x: number, y: number) {
  const map = page.getByTestId('mars-map'), b = await map.boundingBox(); if (!b) throw new Error('Map missing');
  const cx = Number(await map.getAttribute('data-center-x')), cy = Number(await map.getAttribute('data-center-y')), r = Number(await map.getAttribute('data-resolution'));
  return { x: b.x + b.width / 2 + (x - cx) / r, y: b.y + b.height / 2 + (cy - y) / r };
}
async function settledMap(page: Page) {
  let previous = '', stable = 0;
  await waitFor(async () => {
    const b = await page.getByTestId('mars-map').boundingBox();
    const now = b ? `${b.x.toFixed(1)},${b.y.toFixed(1)},${b.width},${b.height}` : '';
    stable = now && now === previous ? stable + 1 : 0; previous = now;
    return stable >= 4 && !!b && b.y >= 0 && b.y + b.height <= page.viewportSize()!.height;
  }, 'Map did not finish scrolling into view');
}
async function outputFiles(path: string): Promise<string[]> {
  const result: string[] = [];
  for (const name of await readdir(path)) { const file = resolve(path, name); if ((await stat(file)).isDirectory()) result.push(...await outputFiles(file)); else result.push(file); }
  return result;
}
try {
  const configurations = productionUrl ? [
    { width: 1440, height: 900, network: 'production' },
    { width: 390, height: 844, network: 'production' },
  ] : [
    { width: 1440, height: 900, network: 'loopback' },
    { width: 1280, height: 720, network: 'loopback' },
    { width: 390, height: 844, network: 'loopback' },
    { width: 360, height: 740, network: 'loopback' },
    { width: 1440, height: 900, network: 'emulated-10Mbps-50ms' },
  ];
  for (const config of configurations.filter(x => !process.env.MARS_AUDIT_WIDTH || x.width === Number(process.env.MARS_AUDIT_WIDTH))) {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: 1, acceptDownloads: true });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    const name = `${config.width}-${config.network}`, errors: string[] = [], external: string[] = [];
    const resources: { path: string; status: number; bodyBytes: number; durationMs: number; contentType: string }[] = [], pending: Promise<void>[] = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await context.route('**/*', route => {
      const url = route.request().url();
      if (new URL(url).origin === base || url.startsWith('blob:')) return route.continue();
      external.push(url); return route.abort(); // Prove the demo has no essential external requests.
    });
    context.on('response', response => pending.push((async () => {
      const timing = response.request().timing();
      const body = await response.body();
      resources.push({ path: response.url().replace(base, ''), status: response.status(), bodyBytes: body.length, durationMs: timing.responseEnd >= 0 ? timing.responseEnd : timing.responseStart, contentType: response.headers()['content-type'] ?? '' });
    })()));
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (config.network === 'emulated-10Mbps-50ms') await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 50, downloadThroughput: 1_250_000, uploadThroughput: 625_000 });
    const started = performance.now(); await page.goto(base);
    await page.waitForFunction(() => document.querySelector('[data-map-ready="true"]') && document.querySelector('[data-science-ready="true"]'));
    const mapAndScienceReadyMs = performance.now() - started;
    await page.waitForLoadState('networkidle'); await Promise.all(pending);
    const initialResources = resources.map(x => ({ ...x }));
    await page.screenshot({ path: `${dir}/${name}-initial.png`, fullPage: true });
    // Exercise the actual new guided action before the manual-regression flow.
    let guidedMission: Record<string, unknown> | null = null;
    if (await page.getByRole('button', { name: /Start Mission/ }).count()) {
      await page.waitForSelector('[data-overview-ready="true"]');
      const initialResolution = Number(await page.getByTestId('mars-map').getAttribute('data-resolution'));
      await page.getByRole('button', { name: 'Acercar mapa', exact: true }).click();
      await page.getByRole('radio', { name: 'Pendiente', exact: true }).click();
      const startAt = performance.now(); await page.getByRole('button', { name: /Start Mission/ }).click();
      await page.waitForSelector('[data-demo-state="complete"]');
      const elapsedMs = performance.now() - startAt;
      await waitFor(async () => Math.abs(Number(await page.getByTestId('mars-map').getAttribute('data-resolution')) - initialResolution) < 1e-5, 'Guided mission did not restore the camera');
      assert.equal(await page.getByTestId('mars-map').getAttribute('data-origin-cell'), JSON.stringify(demo.start));
      assert.equal(await page.getByTestId('mars-map').getAttribute('data-destination-cell'), JSON.stringify(objectives[2]!.cell));
      assert.equal(await page.getByRole('radio', { name: 'Ortoimagen', exact: true }).getAttribute('aria-checked'), 'true');
      const a = planRoute(grid, demo.start, objectives[2]!.cell, { mode: 'distance', lambda: 0, maxSlopeDeg: 15 });
      const b = planRoute(grid, demo.start, objectives[2]!.cell, { mode: 'slope-penalty', lambda: 4, maxSlopeDeg: 15 });
      assert.ok(a.status === 'success' && b.status === 'success');
      const summary = await page.getByTestId('route-insight').innerText();
      assert.ok(summary.includes(compareRoutes(a, b)));
      for (const [id, result] of [['a', a], ['b', b]] as const) {
        for (const key of ['horizontalMeters', 'terrainMeters', 'ascentMeters', 'descentMeters', 'maxSlopeDeg'] as const) assert.equal(Number(await page.getByTestId(`${id}-${key}`).getAttribute('data-value')), result.metrics[key]);
      }
      const overview = page.getByTestId('regional-overview');
      const toggle = overview.getByRole('button', { name: 'JEZERO / CONTEXT' });
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      assert.equal(await overview.locator('svg[role="img"]').getAttribute('data-study-extent'), JSON.stringify([-1968, 1091838, 1968, 1095398]));
      await overview.screenshot({ path: `${dir}/${name}-context.png` });
      if (config.width < 761) await toggle.click();
      await page.locator('#route-comparison').screenshot({ path: `${dir}/${name}-comparison.png` });
      const exports: Record<string, unknown> = {};
      for (const [id, expected] of [['a', a], ['b', b]] as const) {
        await page.getByRole('button', { name: `Ver perfil ruta ${id.toUpperCase()}` }).click();
        const pendingDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar JSON' }).click();
        const download = await pendingDownload, file = `${dir}/${name}-guided-route-${id}.json`; await download.saveAs(file);
        const actual = JSON.parse(await readFile(file, 'utf8')) as RouteSuccess;
        assert.deepEqual(actual.cells, expected.cells); assert.deepEqual(actual.metrics, expected.metrics);
        const audit = auditRoute(grid, actual); assert.equal(audit.passed, true);
        exports[id] = { file, computeTimeMs: actual.computeTimeMs, expandedCells: actual.expandedCells, audit, parameters: actual.parameters };
      }
      guidedMission = { passed: true, start: demo.start, goal: objectives[2]!.cell, roundTripMs: elapsedMs, cameraRestored: true, overviewVerified: true, summary, routeA: a.metrics, routeB: b.metrics, exports };
      // Start the separate manual regression from genuinely empty endpoints.
      await page.getByRole('button', { name: 'Reiniciar', exact: true }).click();
    } else if (process.env.MARS_REQUIRE_GUIDED === '1') throw new Error('Required Start Mission action missing in this deployment');
    // Explicit layer interaction, not static screenshots of a cached example.
    for (const layer of ['Relieve', 'Elevación', 'Pendiente', 'Ortoimagen']) {
      await page.getByRole('radio', { name: layer, exact: true }).click(); await page.waitForLoadState('networkidle');
    }
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: `Consultar objetivo M${i + 1}` }).click(); await cardInViewport(page);
      const card = page.getByTestId('science-inspector');
      assert.ok((await card.innerText()).includes(objectives[i]!.unitName));
      assert.ok((await card.innerText()).includes('100–200 m'));
      assert.ok((await card.innerText()).includes('no es nombre ni estación oficial'));
      const closeBox = await page.getByRole('button', { name: 'Cerrar ficha científica' }).boundingBox();
      assert.ok(closeBox && closeBox.y >= 0 && closeBox.y + closeBox.height <= config.height);
      if (i === 2) {
        const button = page.getByRole('button', { name: 'Usar como destino', exact: true });
        const b = await button.boundingBox(); assert.ok(b && b.y >= 0 && b.y + b.height <= config.height, 'Action needs inner scrolling');
        await card.screenshot({ path: `${dir}/${name}-objective.png` }); await button.click();
      } else await page.getByRole('button', { name: 'Cerrar ficha científica' }).click();
    }
    // Select origin by a true map click; destination stays at the documented M3 cell.
    await page.getByRole('button', { name: 'Seleccionar origen', exact: true }).click();
    await settledMap(page);
    const source = cellCenter(grid, demo.start), click = await pixel(page, source.x, source.y);
    assert.ok(click.y >= 0 && click.y < config.height && click.x >= 0 && click.x < config.width, 'Origin not visible');
    await page.mouse.click(click.x, click.y);
    await waitFor(async () => (await page.getByTestId('mars-map').getAttribute('data-origin-cell')) === JSON.stringify(demo.start), 'Click-to-grid mismatch');
    assert.equal(await page.getByTestId('mars-map').getAttribute('data-destination-cell'), JSON.stringify(objectives[2]!.cell));
    assert.equal(await page.locator('.selection-hint').count(), 0, 'Already-set destination must not be requested again');
    const computeStarted = performance.now(); await page.getByRole('button', { name: 'Calcular rutas', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-calculation-state="complete"]'));
    const bothRoutesUiMs = performance.now() - computeStarted;
    const routes: Record<string, unknown> = {};
    for (const [id, lambda] of [['a', 0], ['b', 4]] as const) {
      await page.getByRole('button', { name: `Ver perfil ruta ${id.toUpperCase()}` }).click();
      const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar JSON' }).click();
      const download = await downloadEvent; const path = `${dir}/${name}-route-${id}.json`; await download.saveAs(path);
      const actual = JSON.parse(await readFile(path, 'utf8')) as RouteSuccess & { scientificContext: { registration: { documentedOffsetMeters: number[] } } };
      const expected = planRoute(grid, demo.start, objectives[2]!.cell, { mode: lambda ? 'slope-penalty' : 'distance', lambda, maxSlopeDeg: 15 });
      if (expected.status !== 'success') throw new Error(`Expected real route failed: ${expected.status}`);
      assert.deepEqual(actual.cells, expected.cells); assert.deepEqual(actual.metrics, expected.metrics);
      assert.deepEqual(actual.scientificContext.registration.documentedOffsetMeters, [100, 200]);
      const audit = auditRoute(grid, actual); assert.equal(audit.passed, true);
      for (const key of ['horizontalMeters', 'ascentMeters', 'descentMeters', 'maxSlopeDeg', 'terrainMeters', 'totalCost'] as const) assert.equal(Number(await page.getByTestId(`${id}-${key}`).getAttribute('data-value')), actual.metrics[key]);
      assert.equal(Number(await page.getByTestId('elevation-profile').getAttribute('data-profile-distance')), actual.metrics.horizontalMeters);
      routes[id] = { parameters: actual.parameters, metrics: actual.metrics, computeTimeMs: actual.computeTimeMs, expandedCells: actual.expandedCells, audit, file: path };
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(200);
    await page.screenshot({ path: `${dir}/${name}-routes.png`, fullPage: true });
    // Geology and photos do not change the computed route model.
    await page.getByRole('button', { name: 'Geología USGS', exact: false }).first().click();
    assert.equal(await page.getByTestId('mars-map').getAttribute('data-geology-features'), '6');
    await page.getByRole('button', { name: 'Nle Lower etched unit', exact: false }).first().click(); await cardInViewport(page);
    assert.ok((await page.getByTestId('science-inspector').innerText()).includes('Sun & Stack'));
    await page.getByTestId('science-inspector').screenshot({ path: `${dir}/${name}-geology.png` });
    await page.getByRole('button', { name: 'Cerrar ficha científica' }).click();
    await page.getByRole('button', { name: 'Geología USGS', exact: false }).first().click();
    await page.getByRole('button', { name: 'Registros Perseverance', exact: true }).click();
    for (const photo of photos) {
      await page.getByRole('button', { name: `${photo.label} RMC ${photo.rmc}`, exact: false }).click(); await cardInViewport(page);
      const card = page.getByTestId('science-inspector');
      await card.locator('img').waitFor(); await page.waitForFunction(() => { const i = document.querySelector('.science-inspector img') as HTMLImageElement | null; return !!i && i.complete && i.naturalWidth > 0; });
      assert.ok((await card.innerText()).includes('NASA/JPL-Caltech')); assert.ok((await card.innerText()).includes(photo.rmc));
      assert.ok((await card.innerText()).includes('no de los blancos'));
      await card.getByText('Verificación documental', { exact: true }).click();
      assert.equal(await card.locator('a[href*="rss/api"]').getAttribute('href'), photo.metadataUrl);
      await card.locator('.science-inspector-body').evaluate(el => { el.scrollTop = 0; });
      if (photo.sol === 107) await card.screenshot({ path: `${dir}/${name}-perseverance.png` });
      await page.getByRole('button', { name: 'Cerrar ficha científica' }).click();
    }
    await page.getByRole('button', { name: 'Procedencia y resolución', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor({ state: 'visible' });
    const scientificText = await dialog.innerText();
    for (const text of ['NASA', 'USGS', '100–200 m', 'no estaciones oficiales', 'Mars Trek']) assert.ok(scientificText.includes(text));
    await page.screenshot({ path: `${dir}/${name}-credits.png`, fullPage: true });
    const creditsResponse = await context.request.get(base + '/THIRD_PARTY_NOTICES.txt'); assert.equal(creditsResponse.status(), 200);
    const credits = await creditsResponse.text(); for (const text of ['Manrope', 'OpenLayers', 'NASA/JPL', 'Sun,', 'React']) assert.ok(credits.includes(text));
    await page.getByRole('button', { name: 'Cerrar fuentes' }).click();
    assert.ok((await page.getByRole('note').innerText()).includes('Ninguno de los dos recorridos certifica seguridad'));
    const layout = await page.evaluate(() => ({ horizontalOverflow: document.documentElement.scrollWidth > innerWidth, safetyFontPx: parseFloat(getComputedStyle(document.querySelector('.model-limitations')!).fontSize) }));
    assert.equal(layout.horizontalOverflow, false); assert.ok(layout.safetyFontPx >= 11);
    await page.waitForLoadState('networkidle'); const settled = await Promise.allSettled(pending);
    const resourceReadErrors = settled.filter(x => x.status === 'rejected').map(x => String((x as PromiseRejectedResult).reason));
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(resources.filter(x => x.status >= 400), []); assert.deepEqual(resourceReadErrors, []);
    const resourceTiming = await page.evaluate(() => performance.getEntriesByType('resource').map(x => { const r = x as PerformanceResourceTiming; return { path: new URL(r.name).pathname, durationMs: r.duration, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize, decodedBodySize: r.decodedBodySize }; }));
    report.scenarios.push({ config, mapAndScienceReadyMs, bothRoutesUiMs, guidedMission, coldBrowserCache: true, externalNetworkBlocked: true, initialBodyBytes: initialResources.reduce((sum, x) => sum + x.bodyBytes, 0), completeFlowBodyBytes: resources.reduce((sum, x) => sum + x.bodyBytes, 0), initialResources, resources, resourceTiming, routes, layout, errors, externalRequests: external, fullFlowPassed: true });
    await context.close(); console.log(`${name}: full flow passed, ready ${mapAndScienceReadyMs.toFixed(1)} ms`);
  }
  const inventory = [];
  for (const file of await outputFiles('out')) {
    const path = relative(resolve('out'), file).replaceAll('\\', '/'), bytes = await readFile(file);
    const response = await fetch(base + '/' + path);
    // Explicit Next.js error documents can correctly be served as HTTP 404.
    assert.ok(response.status === 200 || (productionUrl && response.status === 404 && ['404.html', '_not-found/index.html'].includes(path)), `Static HTTP missing: ${path} (${response.status})`);
    const served = Buffer.from(await response.arrayBuffer());
    const verified = verifyHostedContent(path, bytes, served, siteId);
    inventory.push({ path, extension: extname(path), bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: createHash('sha256').update(bytes).digest('hex'), ...verified, status: response.status, contentType: response.headers.get('content-type'), cacheControl: response.headers.get('cache-control'), contentEncoding: response.headers.get('content-encoding'), finalUrl: response.url });
  }
  report.staticInventory = { files: inventory.length, totalBytes: inventory.reduce((sum, x) => sum + x.bytes, 0), hypotheticalGzipBytes: inventory.reduce((sum, x) => sum + x.gzipBytes, 0), gzipIsMeasuredTransfer: false, entries: inventory };
  report.allPassed = true;
} catch (error) {
  process.exitCode = 1; console.error(String(error));
  const activePage = browser.contexts().at(-1)?.pages().at(-1);
  if (activePage) {
    await activePage.screenshot({ path: `${dir}/audit-failure.png`, fullPage: true });
    await writeFile(`${dir}/audit-failure.json`, JSON.stringify(await activePage.evaluate(() => ({ scrollY, width: innerWidth, height: innerHeight, origin: document.querySelector('[data-origin-cell]')?.getAttribute('data-origin-cell'), destination: document.querySelector('[data-destination-cell]')?.getAttribute('data-destination-cell'), notice: document.querySelector('.mission-notice')?.textContent, map: document.querySelector('[data-testid="mars-map"]')?.outerHTML.slice(0,800) })), null, 2));
  }
  await writeFile(`${dir}/audit-error.txt`, String(error) + '\n'); throw error;
} finally {
  await browser.close();
  if (server) { const closing = new Promise<void>(done => server.close(() => done())); server.closeAllConnections(); await closing; }
  await writeFile(`${dir}/browser-audit.json`, JSON.stringify(report, null, 2) + '\n');
}
