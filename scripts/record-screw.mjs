/**
 * Records the S8 direction check as a GIF (dev only):
 *   node scripts/record-screw.mjs <baseUrl> <outDir>
 * Opens the gauge slowly; the circular marks move DOWN past the datum line and
 * the reading rises.
 */
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
import { findBrowser } from './browser.mjs';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const [base, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: findBrowser() });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
await page.goto(`${base}/screw-gauge.html?seed=K7Q2-9F&gap=2.40&view=scale&loupe=0`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const clip = await page.evaluate(() => {
  const r = document.querySelector('.workspace').getBoundingClientRect();
  return { x: 0, y: r.y, width: Math.floor(r.width), height: Math.floor(r.height) };
});
const gif = GIFEncoder();
const frame = async (delay) => {
  const png = PNG.sync.read(await page.screenshot({ clip }));
  const palette = quantize(png.data, 256);
  gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay });
};
await frame(600);
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => window.__lab.thimbleBy(360 / 50 / 2)); // half a division, opening
  await page.waitForTimeout(40);
  await frame(90);
}
await frame(900);
gif.finish();
writeFileSync(`${outDir}/s8-direction.gif`, gif.bytes());
console.log('s8-direction.gif written');
await browser.close();
