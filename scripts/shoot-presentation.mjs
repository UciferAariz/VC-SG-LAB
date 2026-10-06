/**
 * Presentation-mode screenshots at projector sizes (dev only):
 *   node scripts/shoot-presentation.mjs <baseUrl> <outDir>
 * Also checks that nothing scrolls (page or readout panel).
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { findBrowser } from './browser.mjs';

const [base, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: findBrowser() });
const sizes = [
  [1280, 720],
  [1920, 1080],
  [1024, 768],
];
const lines = [];
for (const [w, hgt] of sizes) {
  for (const [file, name, seed] of [
    ['vernier.html', 'vernier', 'K7Q2-9F'],
    ['screw-gauge.html', 'screw', 'RIZ0-01'],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: hgt } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}/${file}?seed=${seed}`, { waitUntil: 'networkidle' });
    await page.keyboard.press('p');
    await page.waitForTimeout(800);
    for (const [step, label] of [
      [2, 'zero-error'],
      [5, 'reading'],
    ]) {
      await page.evaluate((i) => window.__lab.presentation.go(i), step);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${outDir}/present-${name}-${label}-${w}x${hgt}.png` });
      const scroll = await page.evaluate(() => {
        const p = document.querySelector('.side-panel');
        const minText = Math.min(
          ...[...document.querySelectorAll('.demo-bar *, .readout-row dt, .readout-row dd')]
            .filter((el) => el.offsetParent !== null && el.childNodes[0]?.nodeType === 3 && el.textContent.trim())
            .map((el) => parseFloat(getComputedStyle(el).fontSize)),
        );
        return { page: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth, panel: p.scrollHeight > p.clientHeight + 1, minText };
      });
      lines.push(`${name} ${label} ${w}x${hgt}: page scroll ${scroll.page ? 'YES' : 'no'}, readout scroll ${scroll.panel ? 'YES' : 'no'}, smallest text ${scroll.minText}px${errors.length ? ` ERRORS ${errors.join(' | ')}` : ''}`);
    }
    await page.close();
  }
}
console.log(lines.join('\n'));
await browser.close();
