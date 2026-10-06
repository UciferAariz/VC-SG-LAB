/** Interaction smoke test for the screw gauge page (dev only). node scripts/smoke-screw.mjs <baseUrl> */
import { chromium } from 'playwright-core';
import { findBrowser } from './browser.mjs';

const base = process.argv[2];
const browser = await chromium.launch({ executablePath: findBrowser() });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const requests = [];
page.on('request', (r) => requests.push(r.url()));
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`);

const st = () =>
  page.evaluate(() => {
    const s = window.__lab.store.get();
    const d = window.__lab.derive();
    return { gap: s.mech.gapMm, slack: s.mech.slackMm, slip: s.mech.slipDeg, locked: s.mech.locked, obs: d.reading.observedMm, p: d.pMm, size: d.objectSizeMm, comp: d.compressionMm, maxComp: d.params.maxCompressionMm };
  });
const centre = (sel) =>
  page.evaluate((q) => {
    const r = document.querySelector(q).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel);
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

await page.goto(`${base}/screw-gauge.html?seed=K7Q2-9F&gap=5&loupe=0`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// Thimble drag: pulling the surface down opens the gauge.
let s0 = await st();
let c = await centre('.thimble');
await page.mouse.move(c.x, c.y);
await page.mouse.down();
await page.mouse.move(c.x, c.y + 40, { steps: 5 });
await page.mouse.up();
let s1 = await st();
check('drag down opens (1.5°/px)', close(s1.gap - s0.gap, (40 * 1.5 / 360) * 0.5, 1e-6), `+${(s1.gap - s0.gap).toFixed(5)} mm`);
await page.mouse.move(c.x, c.y);
await page.mouse.down();
await page.mouse.move(c.x, c.y - 40, { steps: 5 });
await page.mouse.up();
check('drag up closes', close((await st()).gap, s0.gap, 1e-6));

// Wheel: one notch = one division (0.01 mm), Shift = ten.
s0 = await st();
await page.mouse.move(c.x, c.y);
await page.mouse.wheel(0, 100);
s1 = await st();
check('wheel notch = 1 division', close(s1.gap - s0.gap, 0.01, 1e-9), `+${(s1.gap - s0.gap).toFixed(4)}`);
await page.keyboard.down('Shift');
await page.mouse.wheel(0, -100);
await page.keyboard.up('Shift');
check('Shift+wheel = 10 divisions', close(s1.gap - (await st()).gap, 0.1, 1e-9));

// Keyboard (instrument focused).
await page.focus('.stage-svg');
s0 = await st();
await page.keyboard.press('ArrowUp');
check('↑ = +1 division', close((await st()).gap - s0.gap, 0.01));
await page.keyboard.press('Shift+ArrowDown');
check('Shift+↓ = −0.1 division', close((await st()).gap - s0.gap, 0.009));
await page.keyboard.press('PageUp');
check('PageUp = one turn (pitch)', close((await st()).gap - s0.gap, 0.509));

// S8 on screen: open by 3 divisions; the datum reading rises and every visible
// circular mark moves DOWN.
const marks = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.circ-labels text')]
      .filter((t) => t.style.display !== 'none')
      .map((t) => ({ label: t.textContent, y: t.getBoundingClientRect().y })),
  );
s0 = await st();
const m0 = await marks();
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
s1 = await st();
const m1 = await marks();
const moved = m0.filter((a) => m1.some((b) => b.label === a.label)).map((a) => m1.find((b) => b.label === a.label).y - a.y);
check('S8: reading increases when opening', s1.obs > s0.obs, `${s0.obs} → ${s1.obs}`);
check('S8: visible circular marks move DOWN on screen', moved.length > 0 && moved.every((d) => d > 0), `Δy px = ${moved.map((d) => d.toFixed(1)).join(', ')}`);

// Lock.
await page.keyboard.press('l');
const sl = await st();
await page.keyboard.press('ArrowUp');
await page.mouse.move(c.x, c.y);
await page.mouse.wheel(0, 300);
check('lock freezes the thimble', (await st()).gap === sl.gap && sl.locked);
await page.click('.lock-lever');
check('clicking the lever unlocks', (await st()).locked === false);

// Ratchet at contact with a wire: slips, clicks, no compression.
await page.goto(`${base}/screw-gauge.html?seed=K7Q2-9F&obj=wire&loupe=0`, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
for (let i = 0; i < 60; i++) await page.keyboard.press('r');
let r1 = await st();
check('ratchet closes onto the wire', close(r1.gap, r1.size), `gap ${r1.gap.toFixed(6)} size ${r1.size.toFixed(6)}`);
const slipBefore = r1.slip;
for (let i = 0; i < 5; i++) await page.keyboard.press('r');
let r2 = await st();
check('ratchet slips at contact: gap unchanged, no squash', r2.gap === r1.gap && r2.comp === 0);
check('slip accumulates (clicks every 18°)', r2.slip - slipBefore >= 5 * 18 - 1e-9, `${(r2.slip - slipBefore).toFixed(1)}°`);

// Over-tightening with the thimble.
await page.focus('.stage-svg');
const o0 = await st();
const reads = [];
for (let i = 0; i < 12; i++) {
  await page.keyboard.press('ArrowDown');
  reads.push((await st()).comp);
}
const mono = reads.every((v, i) => i === 0 || v >= reads[i - 1]);
check('thimble over-tighten squashes monotonically', mono && reads.at(-1) > 0, `comp ${reads.at(-1).toFixed(4)} mm`);
check('squash capped at maxCompression', reads.at(-1) <= o0.maxComp + 1e-12, `max ${o0.maxComp}`);
check('over-tightened reading below the true size', (await st()).obs < o0.size);

// Open button goes to a gap that cannot reveal the size in hidden modes; here it opens near the object.
await page.click('button[title="Open the gauge (O)"]');
await page.waitForTimeout(900);
check('Open control opens the gauge', (await st()).gap > o0.size + 0.3);

// Backlash: reversing direction costs a dead zone.
await page.goto(`${base}/screw-gauge.html?seed=K7Q2-9F&gap=5&backlash=1&loupe=0`, { waitUntil: 'networkidle' });
await page.focus('.stage-svg');
const b = await page.evaluate(() => window.__lab.backlashDeg());
await page.keyboard.press('PageUp'); // opening: slack taken up to w
const k0 = await st();
await page.evaluate((deg) => window.__lab.thimbleBy(-deg * 0.5), b);
const k1 = await st();
check('backlash: reversing first turns thimble without moving spindle', k1.gap === k0.gap && k1.p < k0.p, `b = ${b.toFixed(2)}°`);
await page.evaluate((deg) => window.__lab.thimbleBy(-deg), b);
const k2 = await st();
check('backlash: then the spindle moves', k2.gap < k1.gap);

check('no page errors', errors.length === 0, errors.join(' | '));
const external = requests.filter((u) => !u.startsWith(base));
check('no external network requests', external.length === 0, external.join(', '));
console.log(results.join('\n'));
await browser.close();
