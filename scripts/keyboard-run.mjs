/**
 * Keyboard-only run-through (dev only):  node scripts/keyboard-run.mjs <baseUrl> <outFile>
 * After loading each page, only keyboard events are used. Checks focus order,
 * visible focus rings, instrument control, tabs, a Practice answer, settings
 * and Presentation mode. Also lists any control smaller than 44 × 44 px.
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { findBrowser } from './browser.mjs';

const [base, outFile] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: findBrowser() });
const lines = [];
const log = (s) => lines.push(s);
const check = (name, ok, info = '') => log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`);

const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      label: el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim().slice(0, 40) || el.id,
      role: el.getAttribute('role') || '',
      type: el.getAttribute('type') || '',
      value: el.value ?? '',
      ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
    };
  });

async function tabTo(page, pred, max = 120, shift = false) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
    const a = await active(page);
    if (pred(a)) return a;
  }
  return null;
}

async function smallTargets(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, a, input, select, [role="tab"], [tabindex="0"]')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const hit = el.closest('label') ?? el;
        const lab = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
        const rr = lab ? lab.getBoundingClientRect() : r;
        return { name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30) || el.tagName, w: Math.max(r.width, rr.width), h: Math.max(r.height, rr.height), hit: hit.tagName };
      })
      .filter((x) => x.w < 44 || x.h < 44),
  );
}

for (const [path, kind] of [
  ['/vernier.html?seed=K7Q2-9F', 'vernier'],
  ['/screw-gauge.html?seed=K7Q2-9F', 'screw'],
]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  log(`\n== ${kind} ==`);
  // 1. Focus order and focus rings.
  const order = [];
  let rings = true;
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    const a = await active(page);
    order.push(`${a.tag}${a.role ? `[${a.role}]` : ''} "${a.label}"`);
    rings &&= a.ring;
  }
  log('Focus order (first 16 Tab stops):\n  ' + order.join('\n  '));
  check('every Tab stop shows a visible focus ring (≥ 2 px outline)', rings);

  // 2. Instrument control from the keyboard.
  await page.keyboard.press('Home');
  const stage = await tabTo(page, (a) => a.role === 'slider');
  check('instrument reachable by Tab (role="slider")', !!stage);
  // aria-valuetext is updated on the next animation frame.
  const val = async () => {
    await page.waitForTimeout(120);
    return page.evaluate(() => document.querySelector('.stage-svg').getAttribute('aria-valuetext'));
  };
  const v0 = await val();
  if (kind === 'vernier') {
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('ArrowRight');
  } else {
    await page.keyboard.press('PageUp');
    await page.keyboard.press('ArrowUp');
  }
  const v1 = await val();
  check('arrow keys move the instrument; aria-valuetext follows', v0 !== v1, `"${v0}" → "${v1}"`);
  await page.keyboard.press('l');
  if (kind === 'vernier') await page.keyboard.press('ArrowRight');
  else await page.keyboard.press('ArrowUp');
  check('L locks (keys then do nothing)', (await val()) === v1);
  await page.keyboard.press('l');
  const loupe0 = await page.evaluate(() => window.__lab.store.get().loupeOn);
  await page.keyboard.press('m');
  check('M toggles the magnifier', (await page.evaluate(() => window.__lab.store.get().loupeOn)) !== loupe0);
  await page.keyboard.press('m');
  const z0 = await page.evaluate(() => window.__lab.vp.zoom);
  await page.keyboard.press('+');
  check('+ zooms in', (await page.evaluate(() => window.__lab.vp.zoom)) > z0);
  await page.keyboard.press('0');
  if (kind === 'screw') {
    const g0 = await page.evaluate(() => window.__lab.store.get().mech.gapMm);
    await page.keyboard.press('r');
    check('R turns the ratchet (closes)', (await page.evaluate(() => window.__lab.store.get().mech.gapMm)) < g0);
  }

  // 3. Tabs with arrow keys, then a Practice answer.
  const tab = await tabTo(page, (a) => a.role === 'tab');
  check('side-panel tabs reachable', !!tab, tab?.label);
  await page.keyboard.press('ArrowRight');
  const sel = await page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]').textContent);
  check('→ moves to the Mode tab', sel === 'Mode', sel);
  const practice = await tabTo(page, (a) => a.label.startsWith('Practice'));
  check('Practice card reachable', !!practice);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check('Enter starts Practice (readout hidden)', await page.locator('.readout-panel').isHidden());
  const field = await tabTo(page, (a) => a.tag === 'input');
  check('answer box reachable', !!field);
  await page.keyboard.type(kind === 'vernier' ? '0.01' : '0.01');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const fb = await page.evaluate(() => document.querySelector('.feedback').textContent);
  check('Enter checks the answer; feedback announced (aria-live)', /Correct/.test(fb), fb);
  const explore = await tabTo(page, (a) => a.label.startsWith('Explore'), 60, true);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  check('back to Explore by keyboard (readout shown again)', !!explore && (await page.evaluate(() => !document.querySelector('.readout-panel').hidden)));

  // 4. Settings: theme radio group with arrow keys.
  await tabTo(page, (a) => a.role === 'tab', 60, true);
  // From the Mode tab: → Objects → Settings.
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
  const s2 = await page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]').textContent);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  await tabTo(page, (a) => a.type === 'radio' && ['light', 'dark', 'contrast'].includes(a.value));
  await page.keyboard.press('ArrowRight');
  const theme2 = await page.evaluate(() => document.documentElement.dataset.theme);
  check('Settings tab; theme changes with arrow keys', s2 === 'Settings' && theme2 !== theme, `${theme} → ${theme2}`);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');

  // 5. Presentation with clicker keys.
  await page.locator('body').press('p');
  await page.waitForTimeout(600);
  check('P enters Presentation', await page.evaluate(() => document.body.classList.contains('presenting')));
  await page.keyboard.press('Space');
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(2600);
  const i1 = await page.evaluate(() => window.__lab.presentation.index());
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(1500);
  const i2 = await page.evaluate(() => window.__lab.presentation.index());
  check('Space / PageDown next, Backspace back', i1 === 2 && i2 === 1, `step ${i1 + 1} → ${i2 + 1}`);
  await page.keyboard.press('p');
  check('P leaves Presentation', !(await page.evaluate(() => document.body.classList.contains('presenting'))));

  const small = await smallTargets(page);
  log(`Controls under 44 × 44 px (including their <label>): ${small.length ? small.map((s) => `${s.name} ${Math.round(s.w)}×${Math.round(s.h)}`).join(', ') : 'none'}`);
  await page.close();
}

console.log(lines.join('\n'));
writeFileSync(outFile, lines.join('\n') + '\n');
await browser.close();
