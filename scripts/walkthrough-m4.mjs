/**
 * M4 checkpoint walkthrough (dev only):
 *   node scripts/walkthrough-m4.mjs <baseUrl> <outDir>
 * Runs one full Experiment per instrument (auto-fill), saves the A4 print as
 * PDF and the CSV, then runs Practice with deliberate mistakes and checks the
 * hint category for each. Prints PASS/FAIL lines.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { findBrowser } from './browser.mjs';

const [base, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: findBrowser() });
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`);
const errors = [];

async function open(path, w = 1280, h = 720) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, acceptDownloads: true });
  page.on('pageerror', (e) => errors.push(`${path}: ${e}`));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return page;
}
const snap = (page) => page.evaluate(() => window.__lab.adapter.snapshot());
const answer = async (page, label, value) => {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value));
  await input.press('Enter');
  await page.waitForTimeout(150);
};
const feedbackFor = (page, label) =>
  page.evaluate((l) => {
    const lab = [...document.querySelectorAll('.answer > label')].find((x) => x.textContent === l);
    return lab?.parentElement.querySelector('.feedback')?.textContent ?? '';
  }, label);
const shot = (page, name) => page.screenshot({ path: `${outDir}/${name}.png` });

async function savePrintAndCsv(page, name) {
  await page.evaluate(() => (window.print = () => {}));
  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${outDir}/${name}.pdf`, format: 'A4', printBackground: true });
  await page.screenshot({ path: `${outDir}/${name}-print-preview.png`, fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
  await dl.saveAs(`${outDir}/${name}.csv`);
}

// ── Experiment 1: vernier, pendulum bob, negative zero error ────────────────
{
  const page = await open('/vernier.html?seed=K7Q2-9F&mode=experiment&ze=custom&zeDiv=3&zeSign=-');
  await page.getByRole('button', { name: 'Start experiment' }).click();
  await page.waitForTimeout(600);
  await answer(page, 'Number of divisions on the vernier / circular scale (N)', 10);
  await answer(page, 'N vernier divisions span how many main-scale divisions?', 9);
  await answer(page, 'Least count (cm)', 0.01);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Close jaws', exact: true }).click();
  await page.waitForTimeout(200);
  await shot(page, 'v-01-zero-error-step');
  await page.getByRole('button', { name: 'Record zero error' }).click();
  await page.waitForTimeout(500);
  const z = await snap(page);
  check('vernier experiment: ZE recorded as −0.03 cm', z.ze.zeMm === -0.3, `zeMm ${z.ze.zeMm}`);
  const truth = [];
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Reposition object', exact: true }).click();
    await page.getByRole('button', { name: 'Close jaws', exact: true }).click();
    await page.waitForTimeout(150);
    const s = await snap(page);
    truth.push(s);
    if (i === 1) {
      // Recording twice at one spot must warn.
      await page.getByRole('button', { name: 'Record reading', exact: true }).click();
      await page.getByRole('button', { name: 'Record reading', exact: true }).click();
      const warned = await page.getByText('You have not repositioned').isVisible();
      check('warns when recording twice without repositioning', warned);
      continue;
    }
    await page.getByRole('button', { name: 'Record reading', exact: true }).click();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(300);
  const exp = await page.evaluate(() => window.__lab.modeTab.modes.find((m) => m.id === 'experiment').data());
  const rows = exp.quantities[0].rows;
  check('vernier experiment: 5 rows recorded', rows.length === 5);
  check('every corrected = observed − ZE', rows.every((r) => Math.abs(r.correctedMm - (r.observedMm - exp.ze.zeMm)) < 1e-9));
  const result = await page.locator('.ex-step .result-line').first().textContent();
  check('result line has the (mean ± error) cm form', /^d = \(\d+\.\d{2} ± \d\.\d{2}\) cm$/.test(result), result);
  await shot(page, 'v-02-table-and-analysis');
  await page.locator('.side-panel').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await shot(page, 'v-03-derived-and-export');
  await savePrintAndCsv(page, 'experiment-vernier-bob');
  await page.close();
}

// ── Experiment 2: screw gauge, copper wire, positive zero error, ∥ and ⊥ ────
{
  const page = await open('/screw-gauge.html?seed=RIZ0-01&mode=experiment&ze=custom&zeDiv=4&zeSign=%2B');
  await page.getByRole('button', { name: 'Start experiment' }).click();
  await page.waitForTimeout(600);
  await answer(page, 'Pitch (mm)', 0.5);
  await answer(page, 'Number of divisions on the vernier / circular scale (N)', 50);
  await answer(page, 'Least count (mm)', 0.01);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__lab.adapter.closeOnObject());
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Record zero error' }).click();
  await page.waitForTimeout(400);
  const z = await snap(page);
  check('screw experiment: ZE recorded as +0.04 mm', z.ze.zeMm === 0.04, `zeMm ${z.ze.zeMm}`);
  for (let i = 0; i < 6; i++) {
    const rot = i === 3;
    await page.getByRole('button', { name: rot ? 'Rotate 90°' : 'Reposition object' }).first().click();
    await page.evaluate(() => window.__lab.adapter.animateGap(2, 0));
    await page.waitForTimeout(100);
    // Finish with the ratchet (as the precautions require).
    await page.evaluate(() => window.__lab.adapter.closeOnObject());
    await page.waitForTimeout(300);
    if (i === 5) break;
    await page.getByRole('button', { name: 'Record reading', exact: true }).click();
    await page.waitForTimeout(150);
  }
  const exp = await page.evaluate(() => window.__lab.modeTab.modes.find((m) => m.id === 'experiment').data());
  const rows = exp.quantities[0].rows;
  check('screw experiment: 5 rows recorded', rows.length === 5);
  check('directions ∥ and ⊥ both recorded', rows.some((r) => r.direction === 'perp') && rows.some((r) => r.direction === 'parallel'));
  check('screw corrected = observed − ZE', rows.every((r) => Math.abs(r.correctedMm - (r.observedMm - exp.ze.zeMm)) < 1e-9));
  const result = await page.locator('.ex-step .result-line').first().textContent();
  check('wire result has (mean ± error) mm form', /^d = \(\d\.\d{2} ± \d\.\d{2}\) mm$/.test(result), result);
  await shot(page, 's-01-table-and-analysis');
  await page.locator('.side-panel').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await shot(page, 's-02-derived-and-export');
  await savePrintAndCsv(page, 'experiment-screw-wire');
  await page.close();
}

// ── Practice: deliberate mistakes → targeted hints ──────────────────────────
{
  const page = await open('/vernier.html?seed=K7Q2-9F&mode=practice');
  check('practice hides the readout', await page.locator('.readout-panel').isHidden());
  await answer(page, 'Least count (LC)', 0.1); // cm box: 10× too big
  check('LC unit slip → unit hint', /10 times/.test(await feedbackFor(page, 'Least count (LC)')));
  await answer(page, 'Least count (LC)', 0.01);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Close jaws', exact: true }).click();
  await page.waitForTimeout(300);
  let s = await snap(page);
  const zeCm = s.ze.zeMm / 10;
  await answer(page, 'Zero error (ZE)', (-zeCm).toFixed(2));
  check('ZE sign flipped → sign hint', /Check the sign/.test(await feedbackFor(page, 'Zero error (ZE)')), `ZE ${zeCm.toFixed(2)} cm`);
  await shot(page, 'p-01-sign-hint');
  await answer(page, 'Zero error (ZE)', zeCm.toFixed(2));
  await page.waitForTimeout(1100);
  await page.evaluate(() => window.__lab.adapter.closeOnObject());
  await page.waitForTimeout(1200);
  s = await snap(page);
  await answer(page, 'Main scale reading (MSR)', (s.msrMm / 10).toFixed(2));
  await answer(page, 'Vernier scale reading (VSR, division number)', s.vsr);
  if (s.vsr !== 0) {
    await answer(page, 'Observed reading', (s.msrMm / 10 + s.vsr).toFixed(2));
    check('MSR + n → division-number hint', /n × LC/.test(await feedbackFor(page, 'Observed reading')));
  }
  await answer(page, 'Observed reading', (s.observedMm / 10).toFixed(2));
  await page.waitForTimeout(1100);
  await answer(page, 'Corrected reading', ((s.observedMm + s.ze.zeMm) / 10).toFixed(2));
  check('added ZE → added-ze hint', /added the zero error/.test(await feedbackFor(page, 'Corrected reading')));
  await shot(page, 'p-02-added-ze-hint');
  await answer(page, 'Corrected reading', '9.99');
  await answer(page, 'Corrected reading', '9.98');
  check('3 wrong attempts → worked solution shown', await page.locator('.worked').isVisible());
  await shot(page, 'p-03-worked-solution');
  await page.close();
}
{
  // Screw: the half-mm trap.
  const page = await open('/screw-gauge.html?seed=RIZ0-01&mode=practice');
  await answer(page, 'Least count (LC)', 0.01);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__lab.adapter.closeOnObject());
  await page.waitForTimeout(300);
  let s = await snap(page);
  await answer(page, 'Zero error (ZE)', (s.ze.zeMm).toFixed(2));
  await page.waitForTimeout(1100);
  // Pick an object where the half-mm mark matters: set the gap so PSR has +0.5.
  await page.evaluate(() => window.__lab.adapter.closeOnObject());
  await page.waitForTimeout(600);
  s = await snap(page);
  if (s.halfMmVisible) {
    await answer(page, 'Pitch scale reading (PSR)', (s.msrMm - 0.5).toFixed(2));
    check('missed half-mm mark → half-mm hint', /half-millimetre/.test(await feedbackFor(page, 'Pitch scale reading (PSR)')));
  } else {
    await answer(page, 'Observed reading', (s.observedMm + 0.5).toFixed(2));
    check('off by 0.5 mm → half-mm hint', /half-millimetre/.test(await feedbackFor(page, 'Observed reading')));
  }
  await shot(page, 'p-04-screw-half-mm-hint');
  await page.close();
}
{
  // Guided activities.
  const page = await open('/vernier.html?seed=K7Q2-9F&mode=guided');
  const box = await page.locator('.vernier-scale').boundingBox();
  await page.mouse.move(box.x + box.width * 0.93, box.y + box.height * 0.3);
  await page.waitForTimeout(200);
  check('guided: hovering highlights a vernier span', /Highlighted: vernier marks 0 to \d+/.test(await page.locator('.guided-live').textContent()));
  await answer(page, 'How many divisions are on the vernier scale? (N)', 10);
  await answer(page, 'Mark N coincides with a main-scale mark. How many main-scale divisions do the N vernier divisions span?', 9);
  await answer(page, 'So 1 VSD = ? mm (MSD = 1 mm)', 0.9);
  await answer(page, 'Least count LC = 1 MSD − 1 VSD = ? mm', 0.1);
  check('guided LC summary', /10 VSD = 9 MSD/.test(await page.locator('.result-line').textContent()));
  await shot(page, 'g-01-vernier-least-count');
  await page.close();
}
{
  const page = await open('/screw-gauge.html?seed=K7Q2-9F&mode=guided');
  await page.waitForTimeout(600);
  await answer(page, 'How far did the thimble edge move along the linear scale in one turn? (pitch, mm)', 0.5);
  check('guided pitch: must turn one turn first', /one full turn first/.test(await feedbackFor(page, 'How far did the thimble edge move along the linear scale in one turn? (pitch, mm)')));
  await page.focus('.stage-svg');
  await page.keyboard.press('PageUp');
  await page.waitForTimeout(200);
  await answer(page, 'How far did the thimble edge move along the linear scale in one turn? (pitch, mm)', 0.5);
  await answer(page, 'How many divisions are on the circular scale? (N)', 50);
  await answer(page, 'Least count LC = pitch / N = ? mm', 0.01);
  check('guided pitch summary', /Pitch = 0.5 mm and N = 50/.test(await page.locator('.result-line').textContent()));
  await shot(page, 'g-02-screw-pitch');
  await page.close();
}

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
writeFileSync(`${outDir}/walkthrough-results.txt`, results.join('\n') + '\n');
await browser.close();
