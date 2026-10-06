/**
 * Offline check (dev only):  node scripts/offline-check.mjs <baseUrl> <outFile>
 * 1. Loads every page while blocking (and logging) any request that is not to
 *    the local server — there must be none.
 * 2. Then switches the browser fully offline and keeps using the app
 *    (presentation demo, practice, experiment): everything needed is loaded.
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { findBrowser } from './browser.mjs';

const [base, outFile] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: findBrowser() });
const lines = [];
const check = (name, ok, info = '') => lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`);
const local = (u) => u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:');

for (const path of ['/index.html', '/vernier.html', '/screw-gauge.html', '/notes.html']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const external = [];
  const all = [];
  await context.route('**/*', (route) => {
    const u = route.request().url();
    all.push(u);
    if (local(u)) return route.continue();
    external.push(u);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  check(`${path}: zero requests outside the laptop`, external.length === 0, `(${all.length} local requests${external.length ? `; external: ${external.join(', ')}` : ''})`);
  if (path === '/vernier.html' || path === '/screw-gauge.html') {
    await context.setOffline(true);
    await page.keyboard.press('p');
    for (let i = 0; i < 6; i++) await page.keyboard.press('Space');
    // Steps queue up (each animates); wait for the last one.
    await page.waitForFunction(() => window.__lab.presentation.index() === 6, null, { timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    const step = await page.evaluate(() => window.__lab.presentation.index());
    await page.keyboard.press('p');
    await page.getByRole('tab', { name: 'Mode' }).click();
    await page.evaluate(() => window.__lab.modeTab.select('practice'));
    await page.waitForTimeout(300);
    const practice = await page.locator('.practice .step-title').isVisible();
    await page.evaluate(() => window.__lab.modeTab.select('experiment'));
    await page.getByRole('button', { name: 'Start experiment' }).click();
    await page.waitForTimeout(300);
    const experiment = await page.getByText('Step 1 · Least count').first().isVisible();
    check(`${path}: works with the network OFF (demo to step ${step + 1}, practice, experiment)`, step === 6 && practice && experiment && errors.length === 0, errors.join(' | '));
  } else {
    check(`${path}: no page errors`, errors.length === 0, errors.join(' | '));
  }
  await context.close();
}
console.log(lines.join('\n'));
writeFileSync(outFile, lines.join('\n') + '\n');
await browser.close();
