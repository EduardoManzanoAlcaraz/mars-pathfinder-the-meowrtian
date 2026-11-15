import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'docs/jury-improvement'; await mkdir(output, { recursive: true });
const url = 'https://mars-pathfinder-the-meowrtian.netlify.app';
const browser = await chromium.launch({ executablePath: process.env.MARS_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForSelector('[data-map-ready="true"]');
    await page.waitForSelector('[data-science-ready="true"]');
    await page.screenshot({ path: `${output}/before-${viewport.width}.png`, fullPage: true });
    results.push({ viewport, url: page.url(), errors, title: await page.title() });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/published-baseline.json`, JSON.stringify({ capturedAtUtc: new Date().toISOString(), results }, null, 2) + '\n');
console.log(JSON.stringify(results));
