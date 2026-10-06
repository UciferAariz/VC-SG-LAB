/** Interaction smoke test for the vernier page (dev only). */
import { chromium } from 'playwright-core';
import { findBrowser } from './browser.mjs';
const base = process.argv[2];
const browser = await chromium.launch({ executablePath: findBrowser() });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const requests = [];
page.on('request', (r) => requests.push(r.url()));
await page.goto(`${base}/vernier.html?seed=K7Q2-9F&obj=bob&gap=30`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const st = () => page.evaluate(() => { const s = window.__lab.store.get(); const d = window.__lab.derive(); return { gap: s.gapMm, locked: s.locked, obs: d.reading.observedMm, size: d.objectSizeMm, loupeOn: s.loupeOn, off: s.loupeOffsetMm, zoom: window.__lab.vp.zoom, placement: s.placement.angleDeg }; });
const grip = async () => page.evaluate(() => { const r = document.querySelector('.slider .thumb-grip').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`);

let s0 = await st();
let g = await grip();
await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + 60, g.y, { steps: 5 }); await page.mouse.up();
let s1 = await st();
check('drag opens jaws', s1.gap > s0.gap + 3, `${s0.gap.toFixed(3)} → ${s1.gap.toFixed(3)}`);
g = await grip();
await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x - 900, g.y, { steps: 10 }); await page.mouse.up();
let s2 = await st();
check('jaws stop on the bob (gap = true size)', Math.abs(s2.gap - s2.size) < 1e-9, `gap ${s2.gap.toFixed(6)} size ${s2.size.toFixed(6)}`);
check('reading within LC/2 of true size', Math.abs(s2.obs - s2.size) <= 0.05 + 1e-9, `obs ${s2.obs}`);

await page.focus('.stage-svg');
await page.keyboard.press('l');
let s3 = await st();
check('L locks', s3.locked === true);
g = await grip();
await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + 100, g.y, { steps: 5 }); await page.mouse.up();
let s4 = await st();
check('locked slider does not move (drag)', s4.gap === s3.gap);
await page.keyboard.press('ArrowRight');
check('locked slider does not move (keys)', (await st()).gap === s3.gap);
await page.keyboard.press('l');
await page.keyboard.press('Shift+ArrowRight');
let s5 = await st();
check('Shift+→ opens 1 mm', Math.abs(s5.gap - s3.gap - 1) < 1e-9);
await page.keyboard.press('ArrowRight');
check('→ opens 0.01 mm', Math.abs((await st()).gap - s5.gap - 0.01) < 1e-9);
await page.keyboard.press('Alt+ArrowLeft');
check('Alt+← closes 0.001 mm', Math.abs((await st()).gap - s5.gap - 0.009) < 1e-9);

// Fine mode: same drag moves 10× less.
await page.click('button[title^="Fine mode"]');
const a = await st(); g = await grip();
await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + 50, g.y, { steps: 5 }); await page.mouse.up();
const b = await st();
await page.click('button[title^="Fine mode"]');
g = await grip();
await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + 50, g.y, { steps: 5 }); await page.mouse.up();
const c = await st();
const ratio = (c.gap - b.gap) / (b.gap - a.gap);
check('fine mode = 1/10 sensitivity', Math.abs(ratio - 10) < 0.5, `ratio ${ratio.toFixed(2)}`);

// Nudge buttons (press-and-hold).
const n0 = await st();
const nb = await page.locator('button[aria-label^="Open jaws by 0.01"]').boundingBox();
await page.mouse.move(nb.x + 10, nb.y + 10); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
const n1 = await st();
check('nudge ▶ hold auto-repeats', n1.gap - n0.gap > 0.05, `+${(n1.gap - n0.gap).toFixed(3)} mm`);

// Loupe drag moves its focus offset.
const lens = await page.locator('.loupe-lens circle[stroke-width="9"]').boundingBox();
const l0 = await st();
await page.mouse.move(lens.x + lens.width / 2, lens.y + lens.height / 2); await page.mouse.down(); await page.mouse.move(lens.x + lens.width / 2 + 40, lens.y + lens.height / 2, { steps: 4 }); await page.mouse.up();
const l1 = await st();
check('loupe drag moves focus', l1.off > l0.off, `${l0.off.toFixed(2)} → ${l1.off.toFixed(2)} mm`);
check('slider not moved by loupe drag', l1.gap === l0.gap);
await page.locator('button[aria-label="Zoom in"]').focus();
await page.keyboard.press('m');
check('M toggles magnifier (page-wide shortcut)', (await st()).loupeOn === false);
await page.keyboard.press('m');

// Zoom buttons and ctrl+wheel.
const z0 = (await st()).zoom;
await page.click('button[aria-label="Zoom in"]');
const z1 = (await st()).zoom;
check('zoom-in button', z1 > z0, `${z0.toFixed(2)} → ${z1.toFixed(2)}`);
await page.mouse.move(300, 400);
for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -200, { });
await page.keyboard.down('Control'); for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -300); await page.keyboard.up('Control');
check('zoom clamps at 12×', (await st()).zoom <= 12 + 1e-9, `${(await st()).zoom.toFixed(2)}`);

// Object reposition via the Objects tab.
await page.click('role=tab[name="Objects"]');
const p0 = await st();
await page.click('button[aria-label="Rotate / reposition"]');
const p1 = await st();
check('reposition changes the true size', p1.size !== p0.size, `${p0.size.toFixed(4)} → ${p1.size.toFixed(4)}`);

// Lock-screw click on the instrument.
await page.click('button[aria-label="Fit instrument"]');
await page.focus('.stage-svg'); await page.keyboard.press('m');
await page.click('.lock-screw');
check('clicking the locking screw locks', (await st()).locked === true);

check('no page errors', errors.length === 0, errors.join(' | '));
const external = requests.filter((u) => !u.startsWith(base));
check('no external network requests', external.length === 0, external.join(', '));
console.log(results.join('\n'));
await browser.close();
