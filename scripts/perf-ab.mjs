import { chromium } from 'playwright-core';
import { findBrowser } from './browser.mjs';
const base = process.argv[2];
const browser = await chromium.launch({ executablePath: findBrowser() });
const variants = {
  noBrushLines: () => document.querySelectorAll('[fill="url(#mat-brush-lines)"]').forEach((e) => e.remove()),
  noFakeShadow: () => document.querySelectorAll('.slider path[transform^="translate"]').forEach((e) => e.remove()),
  noLoupeNoShadow: () => { document.querySelector('.loupe').style.display = 'none'; document.querySelectorAll('[filter="url(#flt-shadow)"]').forEach((e) => e.removeAttribute('filter')); },
  staticOnly: () => {
    const inst = document.querySelector('.instrument');
    inst.removeAttribute('filter');
    document.querySelector('.fixed-parts').setAttribute('filter', 'url(#flt-shadow)');
    document.querySelectorAll('.slider [filter="url(#flt-brushed)"]').forEach((e) => e.removeAttribute('filter'));
  },
  baseline: () => {},
  noBrushed: () => document.querySelectorAll('[filter="url(#flt-brushed)"]').forEach((e) => e.removeAttribute('filter')),
  noShadow: () => document.querySelectorAll('[filter="url(#flt-shadow)"]').forEach((e) => e.removeAttribute('filter')),
  noContact: () => document.querySelectorAll('[filter="url(#flt-contact)"]').forEach((e) => e.removeAttribute('filter')),
  noLoupe: () => { document.querySelector('.loupe').style.display = 'none'; },
  noFilters: () => document.querySelectorAll('[filter]').forEach((e) => e.removeAttribute('filter')),
};
for (const [name, fn] of Object.entries(variants).filter(([n]) => !process.argv[3] || process.argv[3].split(',').includes(n))) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${base}/vernier.html?seed=K7Q2-9F&obj=bob&gap=30`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.evaluate(fn);
  const c = await page.evaluate(() => { const r = document.querySelector('.slider .thumb-grip').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.evaluate(() => { window.__f = []; let l = performance.now(); const loop = (t) => { window.__f.push(t - l); l = t; if (window.__f.length < 3000) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  for (let i = 0; i <= 120; i++) await page.mouse.move(c.x + Math.sin((i / 120) * Math.PI * 2) * 160, c.y);
  await page.mouse.up();
  const f = (await page.evaluate(() => window.__f.slice(5))).sort((a, b) => a - b);
  const avg = f.reduce((s, x) => s + x, 0) / f.length;
  console.log(`${name.padEnd(10)} avg=${avg.toFixed(1)}ms (${(1000 / avg).toFixed(0)} fps) p95=${f[Math.floor(f.length * 0.95)].toFixed(1)}`);
  await page.close();
}
await browser.close();
