import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.MARS_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => console.error(error));
  await page.goto(process.env.MARS_PREVIEW_URL || 'http://127.0.0.1:3000');
  await page.waitForFunction(() => document.querySelector('[data-map-ready=true]'));
  await page.getByRole('button', { name: 'Usar ejemplo validado' }).click();
  await page.getByRole('button', { name: 'Calcular rutas', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-calculation-state=complete]'));
  await mkdir('docs/interface-validation', { recursive: true });
  await page.screenshot({ path: 'docs/interface-validation/desktop.png', fullPage: true });
  console.log(await page.title(), await page.locator('.mission-notice').innerText());
} finally { await browser.close(); }
