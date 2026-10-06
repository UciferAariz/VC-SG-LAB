/**
 * Screw gauge page (SPEC §6): Explore mode plus the shared modes.
 */
import '../styles/main.css';
import { codeToSeed } from '../core/rng';
import { SCREW_PRESETS, screwLeastCount, type ScrewPresetId } from '../core/screw/config';
import { thimbleAngleDeg } from '../core/screw/geometry';
import { RATCHET_CLICK_DEG, type MechEvent } from '../core/screw/mechanics';
import { DEFAULT_PLACEMENT, type ScrewObjectKind } from '../core/objects';
import type { LengthUnit } from '../core/units';
import type { ZeroErrorSettings } from '../core/zeroCommon';
import { initAudio, sfx } from '../audio/sfx';
import { buildDefs } from '../render/materials';
import { svg } from '../render/svgUtils';
import { createScrewView, type ScrewHighlight } from '../render/screwView';
import { drawScrewObject, type ScrewObjectSpec } from '../render/screwObjectsView';
import { createLoupe } from '../render/magnifier';
import { Viewport, type Rect } from '../render/viewport';
import { instrumentBounds, LINEAR_ZERO, RATCHET_LEN, RATCHET_NECK, scaleFocusBounds, THIMBLE_LEN } from '../render/screwLayout';
import { onDrag } from '../input/pointer';
import { attachPanZoom } from '../input/gestures';
import { screwKeyAction } from '../input/keyboard';
import { createStore, changed } from '../ui/store';
import { h, holdButton, iconButton, isTypingTarget, segmented, select, tabs, toggle } from '../ui/controls';
import { icons } from '../ui/icons';
import { t } from '../ui/i18n';
import { createReadout, fmtLen, fmtSigned, fmtTrue, fmtZeWorking } from '../ui/readoutPanel';
import { applyTheme, createShell, flashStatus } from '../ui/shell';
import { prefsControls, randomSeed, seedControls, zeroControls, zeroFromQuery } from '../ui/common';
import { savePrefs } from '../ui/prefs';
import { EXPLORE_FLAGS, type LabAdapter, type LabSnapshot, type ModeFlags } from '../ui/lab';
import { createModeTab } from '../ui/modeTab';
import { createPresentation } from '../ui/presentationMode';
import { screwDemo } from '../ui/demoScripts';
import { prefersReducedMotion, tween } from '../ui/anim';
import {
  backlashDegFor,
  derive,
  initialState,
  lockMech,
  objectFor,
  OBJECT_KINDS,
  OPEN_GAP_MM,
  placementFor,
  settle,
  startingGap,
  turnRatchet,
  turnThimble,
  withGap,
  zeroOffsetFor,
  type ScrewState,
} from '../ui/screwModel';
import type { Magnification } from '../ui/vernierModel';

// ── State ────────────────────────────────────────────────────────────────────

/** URL parameters open a ready-made setup (teachers, screenshot scripts). */
function stateFromUrl(): ScrewState {
  const q = new URLSearchParams(location.search);
  const seed = q.has('seed') ? codeToSeed(q.get('seed')!) : randomSeed();
  let s = initialState(seed);
  const preset = q.get('preset') as ScrewPresetId | null;
  if (preset && preset in SCREW_PRESETS) s.presetId = preset;
  const unit = q.get('unit');
  if (unit === 'mm' || unit === 'cm') s.unit = unit;
  const z = zeroFromQuery(q);
  if (z) s.zeroSettings = z;
  s.zeroOffsetMm = zeroOffsetFor(s.seed, s.zeroSettings, SCREW_PRESETS[s.presetId]);
  if (q.get('backlash') === '1') s.backlashOn = true;
  const obj = q.get('obj') as ScrewObjectKind | null;
  if (obj && (OBJECT_KINDS as readonly string[]).includes(obj)) {
    s.objectKind = obj;
    s = { ...s, mech: { ...s.mech, gapMm: startingGap(s) } };
  }
  if (q.has('gap')) s = { ...s, mech: withGap(s, Number(q.get('gap'))) };
  if (q.get('touch') === '1') s = { ...s, mech: withGap(s, 0) };
  if (q.has('mag')) s.loupeMag = (Number(q.get('mag')) as Magnification) || 4;
  if (q.has('loupe')) s.loupeOn = q.get('loupe') !== '0';
  if (q.has('lo')) s.loupeOffsetMm = Number(q.get('lo'));
  if (q.has('aids')) s.aids = q.get('aids') !== '0';
  if (q.has('true')) s.showTrue = q.get('true') === '1';
  if (q.has('zew')) s.showZeWorking = q.get('zew') === '1';
  const theme = q.get('theme');
  if (theme === 'dark' || theme === 'contrast' || theme === 'light') s.theme = theme;
  return s;
}

const store = createStore<ScrewState>(stateFromUrl());
const S = () => store.get();

interface UiState extends ModeFlags {
  candidates: boolean;
  worked: boolean;
  bold: boolean;
  pitchMark: { pMm: number; deg: number } | null;
}
const ui = createStore<UiState>({ ...EXPLORE_FLAGS, candidates: false, worked: false, bold: false, pitchMark: null });
const U = () => ui.get();

// ── Page structure ───────────────────────────────────────────────────────────

const shell = createShell(t.screwTitle, 'screw');
applyTheme(S().theme);
initAudio();

const stageSvg = svg('svg', {
  class: 'stage-svg',
  tabindex: 0,
  role: 'slider',
  'aria-label': t.sgSliderLabel,
  'aria-valuemin': 0,
  'aria-roledescription': t.sgRoleDesc,
  'aria-describedby': 'kbd-help',
});
stageSvg.append(buildDefs());
const view = createScrewView(SCREW_PRESETS[S().presetId]);
stageSvg.append(view.scene);

const overlay = svg('svg', { class: 'stage-overlay', 'aria-hidden': 'true' });
const loupe = createLoupe('screw-scene');
overlay.append(loupe.root);

shell.stage.prepend(stageSvg, overlay);
shell.stage.append(h('p', { id: 'kbd-help', class: 'kbd-help' }, [t.sgKeyboardHelp]));

const vp = new Viewport(stageSvg);

// ── Derived helpers ──────────────────────────────────────────────────────────

function objectSpec(s: ScrewState): ScrewObjectSpec | null {
  const d = derive(s);
  if (!d.object || d.objectSizeMm === null) return null;
  return { obj: d.object, sizeMm: d.objectSizeMm, placement: s.placement, gapMm: s.mech.gapMm, touching: d.touching, compressionMm: d.compressionMm };
}

function highlightFor(s: ScrewState): ScrewHighlight | null {
  const u = U();
  const on = u.worked || (s.aids && u.aidsAllowed);
  if (!on && !u.candidates) return null;
  const d = derive(s);
  const r = d.reading;
  const n = d.config.n;
  const candidates = u.candidates
    ? [-1, 0, 1].map((k) => {
        const j = (((r.csr + k) % n) + n) % n;
        const off = r.csrFraction - (r.csr + k);
        return { j, label: `${j}: ${off >= 0 ? '+' : '−'}${Math.abs(off).toFixed(2)} div` };
      })
    : undefined;
  return { csr: on ? r.csr : -1, psrMm: on ? r.psrMm : -1, candidates };
}

function edgeX(s: ScrewState): number {
  return LINEAR_ZERO + derive(s).pMm;
}

function fitRect(): Rect {
  return instrumentBounds();
}

function defaultRect(s: ScrewState): Rect {
  if (vp.width < 600) {
    const x = edgeX(s);
    return { x: x - 30, y: -14, w: 46, h: 30 };
  }
  // The whole frame plus the thimble and ratchet where they are now.
  const b = instrumentBounds();
  const right = edgeX(s) + THIMBLE_LEN + RATCHET_NECK + RATCHET_LEN + 6;
  return { x: b.x, y: b.y, w: Math.max(100, right - b.x), h: b.h };
}

function focusRect(s: ScrewState): Rect {
  return scaleFocusBounds(edgeX(s));
}

// ── Rendering ────────────────────────────────────────────────────────────────

const readout = createReadout(
  [
    { key: 'config', label: t.sgRConfig, tip: t.sgTipConfig },
    { key: 'pitch', label: t.sgRPitch, tip: t.sgTipPitch },
    { key: 'lc', label: t.rLc, tip: t.sgTipLc },
    { key: 'psr', label: t.sgRPsr, tip: t.sgTipPsr },
    { key: 'csr', label: t.sgRCsr, tip: t.sgTipCsr },
    { key: 'csrlc', label: t.sgRCsrLc, tip: t.sgTipCsrLc },
    { key: 'observed', label: t.rObserved, tip: t.sgTipObserved, emphasis: true },
    { key: 'ze', label: t.rZe, tip: t.sgTipZe },
    { key: 'zc', label: t.rZc, tip: t.tipZc },
    { key: 'corrected', label: t.rCorrected, tip: t.tipCorrected, emphasis: true },
    { key: 'zework', label: t.rZeWorking, tip: t.tipZeWorking },
    { key: 'state', label: t.sgRState, tip: t.sgTipState },
    { key: 'true', label: t.rTrue, tip: t.tipTrue },
  ],
  t.sgRFormula,
);
const readoutHidden = h('p', { class: 'hint readout-hidden' }, [t.readoutHidden]);

function zeText(s: ScrewState): string {
  const d = derive(s);
  const { ze } = d;
  const lcTxt = fmtLen(d.lcMm, s.unit, d.lcMm);
  if (ze.kind === 'none') return `${fmtLen(0, s.unit, d.lcMm)} (${t.zeNone.toLowerCase()})`;
  const rule = ze.kind === 'positive' ? `+${ze.n} × ${lcTxt}` : `−(${ze.N} − ${ze.n}) × ${lcTxt}`;
  return `${fmtSigned(ze.zeMm, s.unit, d.lcMm)}  [n = ${ze.n}: ${rule}]`;
}

function renderReadout(s: ScrewState): void {
  const d = derive(s);
  const u = s.unit;
  const lc = d.lcMm;
  const r = d.reading;
  const observed = fmtLen(r.observedMm, u, lc);
  const corrected = fmtLen(d.correctedMm, u, lc);
  const state = d.compressionMm > 1e-7 ? t.sgSquashing(fmtTrue(d.compressionMm, 'mm')) : d.touching ? t.sgTouching : t.sgFree;
  readout.set(
    {
      config: `${d.config.n} divisions, pitch ${fmtLen(d.config.pitch, 'mm', 0.1)}`,
      pitch: fmtLen(d.config.pitch, 'mm', d.config.pitch === 1 ? 1 : 0.1),
      lc: `${fmtLen(lc, u, lc)}`,
      psr: `${fmtLen(r.psrMm, u, d.config.pitch === 1 ? 1 : 0.1)}${r.halfMmVisible ? ` ${t.sgHalfMm}` : ''}`,
      csr: String(r.csr),
      csrlc: `${r.csr} × ${fmtLen(lc, u, lc)} = ${fmtLen(r.csr * lc, u, lc)}`,
      observed,
      ze: zeText(s),
      zc: fmtSigned(d.ze.correctionMm, u, lc),
      corrected,
      zework: fmtZeWorking(r.observedMm, d.ze.zeMm, d.correctedMm, u, lc),
      state,
      true: `${fmtTrue(s.mech.gapMm, u)} (${t.sgRTrueGap})`,
    },
    U().hideReadout ? '' : `${t.rObserved} ${observed}. ${t.rCorrected} ${corrected}.`,
  );
  readout.setVisible('true', s.showTrue && !U().hideReadout);
  readout.setVisible('zework', s.showZeWorking);
  readout.el.hidden = U().hideReadout;
  readoutHidden.hidden = !U().hideReadout;
  stageSvg.setAttribute('aria-valuemax', String(d.params.maxGapMm));
  if (U().hideAriaReading) {
    stageSvg.setAttribute('aria-valuenow', String(Math.round(s.mech.gapMm)));
    stageSvg.setAttribute('aria-valuetext', d.touching ? t.ariaTouching : t.ariaFree);
  } else {
    stageSvg.setAttribute('aria-valuenow', String(r.observedMm));
    stageSvg.setAttribute('aria-valuetext', t.sgAriaReading(observed));
  }
}

/** Teacher's on/off choice; remembered so the lab opens the same way next time. */
function setLoupeOn(on: boolean): void {
  savePrefs({ loupe: on });
  store.set({ loupeOn: on });
}

function loupeFocus(s: ScrewState): { x: number; y: number } {
  return { x: s.loupePinned ? s.loupePinnedX : edgeX(s) + s.loupeOffsetMm, y: 0 };
}

function renderLoupe(s: ScrewState): void {
  const f = loupeFocus(s);
  const p = vp.worldToScreen(f.x, f.y);
  const radius = Math.max(95, Math.min(170, Math.min(vp.width, vp.height) * (vp.width < 600 ? 0.3 : 0.22)));
  // Keep the lens above the gauge so it does not hide the thimble it magnifies.
  const lift = Math.min(radius + 8 * vp.scale, p.y - 10);
  loupe.update({
    visible: s.loupeOn,
    focusX: f.x,
    focusY: f.y,
    // Up and to the right, clear of the lock lever on the frame.
    screenX: Math.min(vp.width - radius - 6, p.x + radius * 0.75),
    screenY: Math.max(radius + 4, p.y - Math.max(0, lift)),
    viewScale: vp.scale,
    magnification: s.loupeMag,
    radius,
    pinned: s.loupePinned,
  });
}

let lastObjectKey = '';
let sized = false;
function render(s: ScrewState, prev: ScrewState | null): void {
  if (!prev || changed(s, prev, 'presetId')) view.setConfig(SCREW_PRESETS[s.presetId]);
  if (!prev || changed(s, prev, 'theme')) applyTheme(s.theme);
  const d = derive(s);
  const pm = U().pitchMark;
  view.update({
    gapMm: s.mech.gapMm,
    pMm: d.pMm,
    ratchetDeg: d.ratchetDeg,
    locked: s.mech.locked,
    highlight: highlightFor(s),
    boldTicks: U().bold,
    pitchMarker: pm ? { sleeveX: LINEAR_ZERO + pm.pMm, division: 0 } : null,
  });
  const spec = objectSpec(s);
  const key = spec ? `${s.objectKind}|${spec.sizeMm}|${spec.touching}|${s.mech.gapMm < spec.sizeMm ? s.mech.gapMm : 'free'}|${s.seed}` : 'none';
  if (key !== lastObjectKey) {
    drawScrewObject(view.objectBack, view.objectFront, spec);
    lastObjectKey = key;
  }
  renderLoupe(s);
  renderReadout(s);
  syncControls(s);
}

// ── Mechanics: turning, events, sounds ──────────────────────────────────────

let overTightWarned = false;
function handleEvents(events: MechEvent[]): void {
  for (const e of events) {
    if (e.type === 'contact') sfx.contact();
    else if (e.type === 'ratchet-click') {
      sfx.ratchetClick(e.count);
      flashStatus(shell.status, t.sgSlipping, 1200);
    }
  }
}

function lockedWarning(): boolean {
  if (S().mech.locked) {
    flashStatus(shell.status, t.sgLocked);
    return true;
  }
  return false;
}

function thimbleBy(deg: number): void {
  if (lockedWarning() || deg === 0) return;
  const before = derive(S()).compressionMm;
  const r = turnThimble(S(), deg);
  store.set({ mech: r.mech });
  handleEvents(r.events);
  const after = derive(S()).compressionMm;
  if (after > before + 1e-9 && !overTightWarned) {
    overTightWarned = true;
    flashStatus(shell.status, t.sgOverTight, 2600);
    window.setTimeout(() => (overTightWarned = false), 3000);
  }
}

function ratchetBy(deg: number): void {
  if (lockedWarning() || deg === 0) return;
  const r = turnRatchet(S(), deg);
  store.set({ mech: r.mech });
  handleEvents(r.events);
}

const divDeg = () => 360 / SCREW_PRESETS[S().presetId].n;

function toggleLock(): void {
  store.set((s) => ({ mech: lockMech(s, !s.mech.locked) }));
  sfx.lock();
}

let anim: { cancel(): void } | null = null;
function animateGap(target: number, ms = 600): Promise<void> {
  anim?.cancel();
  if (S().mech.locked) return Promise.resolve();
  const from = S().mech.gapMm;
  return new Promise((resolve) => {
    anim = tween(prefersReducedMotion() ? 0 : ms, (k) => store.set((s) => ({ mech: withGap(s, from + (target - from) * k) })), resolve);
  });
}

function openGauge(): void {
  if (lockedWarning()) return;
  const s = S();
  void animateGap(U().revealingOpen && s.objectKind ? startingGap(s) : U().revealingOpen ? 5 : OPEN_GAP_MM);
}

/** Close with the ratchet until it slips (two clicks), animated. */
function closeWithRatchet(): Promise<void> {
  anim?.cancel();
  if (lockedWarning()) return Promise.resolve();
  return new Promise((resolve) => {
    let cancelled = false;
    anim = { cancel: () => (cancelled = true) };
    const startSlip = S().mech.slipDeg;
    const step = () => {
      if (cancelled) return resolve();
      const gapLeft = S().mech.gapMm - derive(S()).params.contactMm;
      const deg = Math.max(6, Math.min(240, (gapLeft / SCREW_PRESETS[S().presetId].pitch) * 360 * 0.25));
      ratchetBy(-deg);
      if (S().mech.slipDeg - startSlip >= 2 * RATCHET_CLICK_DEG) return resolve();
      if (prefersReducedMotion()) step();
      else requestAnimationFrame(step);
    };
    step();
  });
}

// ── Interaction: thimble, ratchet, lock, loupe ──────────────────────────────

const PX_DEG = 1.5;
function rotaryDrag(el: SVGGElement, turn: (deg: number) => void): void {
  let lastY = 0;
  onDrag(el, {
    start(e) {
      if (lockedWarning()) return false;
      lastY = e.clientY;
    },
    move(e) {
      // Pulling the surface DOWN turns it so the marks move down: the gauge opens.
      const dy = e.clientY - lastY;
      lastY = e.clientY;
      turn(dy * (S().fine ? PX_DEG / 10 : PX_DEG));
    },
  });
  let acc = 0;
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) return;
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 300 : 1;
      acc += (e.deltaY || e.deltaX) * unit;
      const notches = Math.trunc(acc / 100);
      if (notches === 0) return;
      acc -= notches * 100;
      // 1 notch = 1 circular division; Shift = 10 divisions (SPEC §6.7).
      turn(notches * (e.shiftKey ? 10 : 1) * divDeg());
    },
    { passive: false },
  );
}
rotaryDrag(view.thimble, thimbleBy);
rotaryDrag(view.ratchet, ratchetBy);

view.lockLever.addEventListener('pointerdown', (e) => e.stopPropagation());
view.lockLever.addEventListener('click', toggleLock);

let loupeStart = { x: 0, offset: 0, pinnedX: 0 };
onDrag(loupe.lens, {
  start(e) {
    loupeStart = { x: e.clientX, offset: S().loupeOffsetMm, pinnedX: S().loupePinnedX };
  },
  move(e) {
    const dmm = (e.clientX - loupeStart.x) / vp.scale;
    if (S().loupePinned) store.set({ loupePinnedX: loupeStart.pinnedX + dmm });
    else store.set({ loupeOffsetMm: loupeStart.offset + dmm });
  },
});
overlay.addEventListener('pointerdown', (e) => {
  if (e.target === overlay) e.stopPropagation();
});

attachPanZoom(stageSvg, vp);

/** Page-wide key handler; returns true if the key was used. Presentation mode may pre-empt it. */
function handleKey(e: KeyboardEvent): boolean {
  const target = e.target as Element;
  if (isTypingTarget(target)) return false;
  const a = screwKeyAction(e);
  if (!a) return false;
  // Rotation keys act only while the instrument has focus; letters work page-wide.
  if ((a.type === 'thimble' || a.type === 'turns') && target !== stageSvg) return false;
  e.preventDefault();
  switch (a.type) {
    case 'thimble':
      thimbleBy(a.divisions * divDeg());
      break;
    case 'turns':
      thimbleBy(a.turns * 360);
      break;
    case 'ratchet':
      ratchetBy(a.deg);
      break;
    case 'open':
      openGauge();
      break;
    case 'lock':
      toggleLock();
      break;
    case 'loupe':
      setLoupeOn(!S().loupeOn);
      break;
    case 'zoom':
      vp.zoomAt(a.factor);
      break;
    case 'fit':
      vp.show(fitRect());
      break;
    case 'focus':
      vp.show(focusRect(S()));
      break;
    case 'reset':
      vp.show(defaultRect(S()));
      break;
  }
  return true;
}
document.addEventListener('keydown', (e) => {
  if (!e.defaultPrevented) handleKey(e);
});

// ── Stage toolbar & dock ─────────────────────────────────────────────────────

shell.toolbar.append(
  iconButton(icons.zoomIn, t.cZoomIn, () => vp.zoomAt(1.25)),
  iconButton(icons.zoomOut, t.cZoomOut, () => vp.zoomAt(0.8)),
  iconButton(icons.reset, t.cReset, () => vp.show(defaultRect(S()))),
  iconButton(icons.fit, t.cFit, () => vp.show(fitRect())),
  iconButton(icons.focus, t.cFocus, () => vp.show(focusRect(S()))),
);

const lockBtn = iconButton(icons.lock, t.sgLockTitle, toggleLock, { text: t.cLock, cls: 'btn-dock' });
const fineBtn = iconButton(icons.fine, t.sgFineTitle, () => store.set((s) => ({ fine: !s.fine })), { text: t.cFine, cls: 'btn-dock' });
const loupeBtn = iconButton(icons.loupe, t.cLoupe, () => setLoupeOn(!S().loupeOn), { text: t.cLoupeText, cls: 'btn-dock' });
const pinBtn = iconButton(
  icons.pin,
  t.cPin,
  () => store.set((s) => (s.loupePinned ? { loupePinned: false, loupeOffsetMm: loupeFocus(s).x - edgeX(s) } : { loupePinned: true, loupePinnedX: loupeFocus(s).x })),
  { cls: 'btn-dock' },
);
const openBtn = iconButton(icons.open, t.sgOpenTitle, openGauge, { text: t.sgOpen, cls: 'btn-dock' });
const ratchetBtn = holdButton(icons.ratchet, t.sgRatchetClose, (fast) => ratchetBy(fast ? -36 : -12), 'btn-dock btn-nudge btn-ratchet');
ratchetBtn.append(h('span', { class: 'btn-text' }, [t.sgRatchet]));
shell.dock.append(
  openBtn,
  loupeBtn,
  pinBtn,
  fineBtn,
  lockBtn,
  holdButton(icons.down, t.sgThimbleClose, (fast) => thimbleBy(-(fast ? 5 : 1) * divDeg()), 'btn-dock btn-nudge'),
  holdButton(icons.up, t.sgThimbleOpen, (fast) => thimbleBy((fast ? 5 : 1) * divDeg()), 'btn-dock btn-nudge'),
  ratchetBtn,
);

// ── Side panel ───────────────────────────────────────────────────────────────

const objLabels: Record<ScrewObjectKind, string> = {
  wire: t.sgObjWire,
  sheet: t.sgObjSheet,
  slide: t.sgObjSlide,
  ball: t.sgObjBall,
  paper: t.sgObjPaper,
  hair: t.sgObjHair,
  blade: t.sgObjBlade,
  needle: t.sgObjNeedle,
  lead: t.sgObjLead,
  card: t.sgObjCard,
};
const derivedFor: Record<ScrewObjectKind, LabAdapter['objects'][number]['derived']> = {
  wire: 'wireArea',
  sheet: null,
  slide: null,
  ball: 'sphereVolume',
  paper: null,
  hair: 'circleArea',
  blade: null,
  needle: 'circleArea',
  lead: 'circleArea',
  card: null,
};

function setObject(kind: ScrewObjectKind | null): void {
  store.set((s) => {
    const next: ScrewState = { ...s, objectKind: kind, placement: DEFAULT_PLACEMENT, placementCount: 0, mech: { ...s.mech, locked: false } };
    return { ...next, mech: { ...next.mech, gapMm: kind ? startingGap(next) : Math.max(2, s.mech.gapMm), slackMm: 0 } };
  });
}

const objectSelect = select<string>(
  t.tabObjects,
  [{ value: 'none', label: t.objNone }, ...OBJECT_KINDS.map((k) => ({ value: k, label: objLabels[k] }))],
  S().objectKind ?? 'none',
  (v) => setObject(v === 'none' ? null : (v as ScrewObjectKind)),
);

function reposition(how: 'along' | 'rotate' | 'random'): void {
  store.set((s) => {
    const count = s.placementCount + 1;
    const next = { ...s, placementCount: count, placement: placementFor(s.seed, count, s.placement, how) };
    return { placementCount: count, placement: next.placement, mech: settle(next) };
  });
}
const alongBtn = iconButton(icons.along, t.sgMoveAlong, () => reposition('along'), { text: t.sgMoveAlong, cls: 'btn-wide' });
const rotBtn = iconButton(icons.rotate, t.sgRotate90, () => reposition('rotate'), { text: t.sgRotate90, cls: 'btn-wide' });
const repoBtn = iconButton(icons.rotate, t.sgReposition, () => reposition('random'), { text: t.sgReposition, cls: 'btn-wide' });
const directionHint = h('p', { class: 'hint direction' });
const wireHint = h('p', { class: 'hint' }, [t.sgWireHint]);
const objectsPanel = h('div', {}, [objectSelect.el, alongBtn, rotBtn, repoBtn, directionHint, wireHint, h('p', { class: 'hint' }, [t.sgObjHint])]);

const presetSelect = select<ScrewPresetId>(
  t.sgPreset,
  (Object.keys(SCREW_PRESETS) as ScrewPresetId[]).map((id) => ({ value: id, label: SCREW_PRESETS[id].label })),
  S().presetId,
  (id) =>
    store.set((s) => {
      const next = { ...s, presetId: id, zeroOffsetMm: zeroOffsetFor(s.seed, s.zeroSettings, SCREW_PRESETS[id]) };
      return { ...next, mech: withGap(next, s.mech.gapMm) };
    }),
);
const unitSeg = segmented<LengthUnit>(t.sUnit, [{ value: 'mm', label: 'mm' }, { value: 'cm', label: 'cm' }], S().unit, (u) => store.set({ unit: u }));
function setZero(settings: ZeroErrorSettings): void {
  store.set((s) => {
    const next = { ...s, zeroSettings: settings, zeroOffsetMm: zeroOffsetFor(s.seed, settings, SCREW_PRESETS[s.presetId]) };
    return { ...next, mech: withGap(next, s.mech.gapMm) };
  });
}
const zeCtl = zeroControls(() => S().zeroSettings, setZero, 9);
const backlashToggle = toggle(t.sgBacklash, S().backlashOn, (on) => store.set((s) => ({ backlashOn: on, mech: { ...s.mech, slackMm: 0 } })));
const aidsToggle = toggle(t.sAids, S().aids, (on) => store.set({ aids: on }));
const trueToggle = toggle(t.sShowTrue, S().showTrue, (on) => store.set({ showTrue: on }));
const zeWorkingToggle = toggle(t.sShowZeWorking, S().showZeWorking, (on) => store.set({ showZeWorking: on }));
const loupeToggle = toggle(t.sMagnifier, S().loupeOn, setLoupeOn);
const magSeg = segmented<string>(t.sMagnification, [{ value: '4', label: '4×' }, { value: '6', label: '6×' }, { value: '8', label: '8×' }], String(S().loupeMag), (v) =>
  store.set({ loupeMag: Number(v) as Magnification }),
);
const prefsCtl = prefsControls((th) => store.set({ theme: th }));
function applySeed(seed: number): void {
  store.set((s) => {
    const next: ScrewState = { ...s, seed, zeroOffsetMm: zeroOffsetFor(seed, s.zeroSettings, SCREW_PRESETS[s.presetId]), placementCount: 0, placement: DEFAULT_PLACEMENT };
    return { ...next, mech: { ...s.mech, gapMm: next.objectKind ? startingGap(next) : s.mech.gapMm, slackMm: 0 } };
  });
}
const seedCtl = seedControls(() => S().seed, applySeed, shell.status);

const settingsPanel = h('div', {}, [
  presetSelect.el,
  unitSeg.el,
  zeCtl.el,
  zeWorkingToggle.el,
  backlashToggle.el,
  h('p', { class: 'hint' }, [t.sgBacklashHelp]),
  aidsToggle.el,
  loupeToggle.el,
  magSeg.el,
  trueToggle.el,
  prefsCtl.el,
  seedCtl.el,
]);

// ── Adapter for the modes ────────────────────────────────────────────────────

function snapshot(): LabSnapshot {
  const s = S();
  const d = derive(s);
  return {
    instrument: 'screw',
    unit: s.unit,
    lcMm: d.lcMm,
    N: d.config.n,
    pitchMm: d.config.pitch,
    configKey: d.config.id,
    configLabel: d.config.label,
    msrMm: d.reading.psrMm,
    vsr: d.reading.csr,
    observedMm: d.reading.observedMm,
    ze: d.ze,
    correctedMm: d.correctedMm,
    trueMm: s.mech.gapMm,
    objectKind: s.objectKind,
    dimId: d.object?.dimensions[0]!.id ?? '',
    touching: d.touching,
    closed: !s.objectKind && d.touching,
    placementKey: `${s.objectKind}:${s.placementCount}:${s.placement.perpendicular}`,
    direction: s.objectKind === 'wire' ? (s.placement.perpendicular ? 'perp' : 'parallel') : null,
    halfMmVisible: d.reading.halfMmVisible,
    compressionMm: d.compressionMm,
    locked: s.mech.locked,
  };
}

const adapter: LabAdapter = {
  instrument: 'screw',
  title: t.screwTitle,
  objects: OBJECT_KINDS.map((k) => {
    const o = objectFor(S().seed, k);
    const d = o.dimensions[0]!;
    return {
      kind: k,
      label: objLabels[k],
      dims: [{ id: d.id, label: k === 'paper' ? t.sgPaperThickness : d.label, symbol: d.symbol }],
      derived: derivedFor[k],
      aimNoun: t.aimNoun[k] ?? objLabels[k],
    };
  }),
  snapshot,
  subscribe: (fn) => {
    const a = store.subscribe(fn);
    const b = ui.subscribe(fn);
    return () => {
      a();
      b();
    };
  },
  setFlags: (f) => ui.set(f),
  setObject: (kind) => setObject(kind as ScrewObjectKind | null),
  setZeroSettings: setZero,
  zeroSettings: () => S().zeroSettings,
  reposition: () => reposition(S().objectKind === 'wire' ? 'along' : 'random'),
  rotate90: () => reposition('rotate'),
  showCandidates: (on) => ui.set({ candidates: on }),
  showWorked: (on) => ui.set({ worked: on }),
  setAids: (on) => store.set({ aids: on }),
  setLocked: (on) => store.set((s) => ({ mech: lockMech(s, on) })),
  setLoupe: (on) => store.set({ loupeOn: on }),
  view: (k) => vp.show(k === 'fit' ? fitRect() : k === 'scale' ? focusRect(S()) : defaultRect(S())),
  animateGap,
  closeOnObject: closeWithRatchet,
  setBold: (on) => ui.set({ bold: on }),
  flash: (text) => flashStatus(shell.status, text, 2600),
  seed: () => S().seed,
  guided: {
    markStart(on) {
      const d = derive(S());
      ui.set({ pitchMark: on ? { pMm: d.pMm, deg: d.thimbleDeg } : null });
    },
    sinceStart() {
      const pm = U().pitchMark;
      if (!pm) return null;
      const d = derive(S());
      return { turns: (d.thimbleDeg - pm.deg) / 360, edgeMm: d.pMm - pm.pMm };
    },
  },
};

const modeTab = createModeTab(adapter, { onPresent: () => presentation.toggle() });

const panelTabs = tabs([
  { id: 'readout', label: t.tabReadout, panel: h('div', {}, [readoutHidden, readout.el]) },
  { id: 'mode', label: t.tabMode, panel: modeTab.el },
  { id: 'objects', label: t.tabObjects, panel: objectsPanel },
  { id: 'settings', label: t.tabSettings, panel: settingsPanel },
]);
shell.panel.append(panelTabs.el);

const presentation = createPresentation(adapter, shell.stage, screwDemo(), {
  beforeEnter() {
    modeTab.select('explore');
    panelTabs.select(0);
  },
  theme: (th) => store.set({ theme: th }),
});
shell.toolbar.append(iconButton(icons.present, t.modePresentation + ' (P)', () => presentation.toggle(), { cls: 'btn-present' }));

function syncControls(s: ScrewState): void {
  // Rebuild the lock button only when the state changes (this runs every frame while dragging).
  if (lockBtn.getAttribute('aria-pressed') !== String(s.mech.locked)) {
    lockBtn.innerHTML = s.mech.locked ? icons.lock : icons.unlock;
    lockBtn.append(h('span', { class: 'btn-text' }, [s.mech.locked ? t.cUnlock : t.cLock]));
    lockBtn.setAttribute('aria-pressed', String(s.mech.locked));
  }
  fineBtn.setAttribute('aria-pressed', String(s.fine));
  loupeBtn.setAttribute('aria-pressed', String(s.loupeOn));
  pinBtn.setAttribute('aria-pressed', String(s.loupePinned));
  pinBtn.disabled = !s.loupeOn;
  presetSelect.set(s.presetId);
  unitSeg.set(s.unit);
  zeCtl.sync(s.zeroSettings);
  // While values are hidden (Practice, manual Experiment) the zero error is part of the task.
  zeCtl.setDisabled(U().hideReadout);
  backlashToggle.set(s.backlashOn);
  aidsToggle.set(s.aids);
  aidsToggle.el.hidden = !U().aidsAllowed;
  trueToggle.set(s.showTrue);
  trueToggle.el.hidden = U().hideReadout;
  zeWorkingToggle.set(s.showZeWorking);
  zeWorkingToggle.el.hidden = U().hideReadout;
  loupeToggle.set(s.loupeOn);
  magSeg.set(String(s.loupeMag));
  prefsCtl.sync(s.theme);
  seedCtl.sync(s.seed);
  objectSelect.set(s.objectKind ?? 'none');
  const isWire = s.objectKind === 'wire';
  alongBtn.hidden = !isWire;
  rotBtn.hidden = !isWire;
  wireHint.hidden = !isWire;
  repoBtn.hidden = !s.objectKind || isWire;
  directionHint.hidden = !isWire;
  directionHint.textContent = isWire ? t.sgDirection(s.placement.perpendicular) : '';
  shell.stage.classList.toggle('is-locked', s.mech.locked);
}

// ── Boot ─────────────────────────────────────────────────────────────────────

store.subscribe((s, prev) => render(s, prev));
ui.subscribe(() => render(S(), S()));
vp.onChange(() => renderLoupe(S()));

new ResizeObserver(() => {
  const r = stageSvg.getBoundingClientRect();
  vp.setSize(r.width, r.height);
  overlay.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  vp.setFitRect(fitRect());
  if (!sized) {
    sized = true;
    const q = new URLSearchParams(location.search).get('view');
    vp.show(q === 'fit' ? fitRect() : q === 'scale' ? focusRect(S()) : defaultRect(S()));
  }
  renderLoupe(S());
}).observe(stageSvg);

render(S(), null);

// ?mode=practice|experiment|guided opens straight into a mode (teachers, scripts).
const startMode = new URLSearchParams(location.search).get('mode');
if (startMode && modeTab.modes.some((m) => m.id === startMode)) {
  modeTab.select(startMode);
  panelTabs.select(1);
}

// Debug/automation hook (screenshot and smoke scripts; harmless otherwise).
(window as unknown as { __lab: unknown }).__lab = {
  store,
  ui,
  vp,
  adapter,
  modeTab,
  presentation,
  derive: () => derive(S()),
  thimbleBy,
  ratchetBy,
  backlashDeg: () => backlashDegFor(S().seed),
  angleOf: (p: number) => thimbleAngleDeg(p, SCREW_PRESETS[S().presetId]),
  lc: () => screwLeastCount(SCREW_PRESETS[S().presetId]),
};
