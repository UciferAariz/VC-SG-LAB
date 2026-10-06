/**
 * Drag performance check + GIF recording (dev only).
 *   node scripts/perf-drag.mjs <baseUrl> <outDir>
 * Drags the vernier slider with a real mouse in Chrome, measures frame
 * intervals with requestAnimationFrame, and writes drag.gif.
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

async function sliderCentre(page) {
  return page.evaluate(() => {
    // On a phone the thumb grip is outside the default view: grab the vernier scale instead.
    const grip = document.querySelector('.slider .thumb-grip').getBoundingClientRect();
    const r = grip.right < innerWidth && grip.x > 0 ? grip : document.querySelector('.vernier-scale').getBoundingClientRect();
    return { x: r.x + Math.min(r.width / 2, 40), y: r.y + r.height / 2 };
  });
}

async function measure(width, height, throttle) {
  const page = await browser.newPage({ viewport: { width, height } });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`${base}/vernier.html?seed=K7Q2-9F&obj=bob&gap=30`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const c = await sliderCentre(page);
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const loop = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__frames.length < 2000) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const dx = Math.sin((i / steps) * Math.PI * 2) * 160;
    await page.mouse.move(c.x + dx, c.y);
  }
  await page.mouse.up();
  const frames = await page.evaluate(() => window.__frames.slice(5));
  frames.sort((a, b) => a - b);
  const pct = (p) => frames[Math.min(frames.length - 1, Math.floor(frames.length * p))].toFixed(1);
  const avg = frames.reduce((s, x) => s + x, 0) / frames.length;
  console.log(`${width}x${height} cpu×${throttle}: frames=${frames.length} avg=${avg.toFixed(1)}ms (${(1000 / avg).toFixed(0)} fps) p50=${pct(0.5)} p95=${pct(0.95)} max=${pct(0.999)}`);
  await page.close();
}

/** Screw gauge: vertical drag on the thimble (the circular scale re-projects every frame). */
async function measureScrew(width, height, throttle) {
  const page = await browser.newPage({ viewport: { width, height } });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`${base}/screw-gauge.html?seed=K7Q2-9F&gap=8`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const c = await page.evaluate(() => {
    const r = document.querySelector('.thimble').getBoundingClientRect();
    return { x: r.x + Math.min(r.width / 2, 30), y: r.y + r.height / 2 };
  });
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const loop = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__frames.length < 2000) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 0; i <= 120; i++) await page.mouse.move(c.x, c.y + Math.sin((i / 120) * Math.PI * 2) * Math.min(160, height / 5));
  await page.mouse.up();
  const frames = await page.evaluate(() => window.__frames.slice(5));
  frames.sort((a, b) => a - b);
  const pct = (p) => frames[Math.min(frames.length - 1, Math.floor(frames.length * p))].toFixed(1);
  const avg = frames.reduce((s, x) => s + x, 0) / frames.length;
  console.log(`screw ${width}x${height} cpu×${throttle}: frames=${frames.length} avg=${avg.toFixed(1)}ms (${(1000 / avg).toFixed(0)} fps) p50=${pct(0.5)} p95=${pct(0.95)} max=${pct(0.999)}`);
  await page.close();
}

const only = process.argv[4];
if (only !== 'screw') {
  await measure(1280, 720, 1);
  await measure(1920, 1080, 1);
  await measure(1920, 1080, 4);
  await measure(412, 915, 4);
}
await measureScrew(1280, 720, 1);
await measureScrew(1920, 1080, 1);
await measureScrew(1920, 1080, 4);
await measureScrew(412, 915, 4);
if (only === 'screw') {
  await browser.close();
  process.exit(0);
}

// GIF of a drag: open, close onto the bob, magnifier following.
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
  await page.goto(`${base}/vernier.html?seed=K7Q2-9F&obj=bob&gap=30&lo=4.5`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const c = await sliderCentre(page);
  const clip = await page.evaluate(() => {
    const r = document.querySelector('.workspace').getBoundingClientRect();
    return { x: 0, y: r.y, width: Math.floor(r.width), height: Math.floor(r.height) };
  });
  const gif = GIFEncoder();
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  const path = [];
  for (let i = 0; i <= 14; i++) path.push(c.x + i * 9);
  for (let i = 14; i >= -30; i--) path.push(c.x + i * 9);
  for (const x of path) {
    await page.mouse.move(x, c.y, { steps: 2 });
    await page.waitForTimeout(30);
    const png = PNG.sync.read(await page.screenshot({ clip }));
    const palette = quantize(png.data, 256);
    gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay: 70 });
  }
  await page.mouse.up();
  for (let i = 0; i < 6; i++) {
    const png = PNG.sync.read(await page.screenshot({ clip }));
    const palette = quantize(png.data, 256);
    gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay: 250 });
  }
  gif.finish();
  writeFileSync(`${outDir}/drag.gif`, gif.bytes());
  console.log('drag.gif written');
  await page.close();
}

await browser.close();
