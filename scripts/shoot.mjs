/**
 * Screenshot helper (dev only). Uses the locally installed Chrome/Edge via
 * playwright-core — nothing is downloaded.
 *
 *   node scripts/shoot.mjs <baseUrl> <outDir> <name>=<WxH>@<path?query> ...
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { findBrowser } from './browser.mjs';

const [base, outDir, ...shots] = process.argv.slice(2);
if (base && outDir) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: findBrowser() });
  for (const spec of shots) {
    const m = spec.match(/^([^=]+)=(\d+)x(\d+)@(.*)$/);
    if (!m) throw new Error(`bad spec ${spec}`);
    const [, name, w, hgt, path] = m;
    const page = await browser.newPage({ viewport: { width: Number(w), height: Number(hgt) }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/${name}.png` });
    console.log(`${name}.png`, errors.length ? `ERRORS: ${errors.join(' | ')}` : 'ok');
    await page.close();
  }
  await browser.close();
}
