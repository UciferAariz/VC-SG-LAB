/**
 * Vernier callipers page (SPEC §5): Explore mode plus the shared modes.
 */
import '../styles/main.css';
import { codeToSeed } from '../core/rng';
import { maxGapMm, vernierSpanMm, vsd, VERNIER_PRESETS, type VernierPresetId } from '../core/vernier/config';
import { vernierTicks } from '../core/vernier/geometry';
import type { ZeroErrorSettings } from '../core/zeroCommon';
import type { LengthUnit } from '../core/units';
import { getDimension, DEFAULT_PLACEMENT, type VernierObjectKind } from '../core/objects';
import { initAudio, sfx } from '../audio/sfx';
import { buildDefs } from '../render/materials';
import { n4, svg } from '../render/svgUtils';
import { createVernierView, type HighlightSpec } from '../render/vernierView';
import { drawVernierObject, objectExtent, type VernierObjectSpec } from '../render/objectsView';
import { createLoupe } from '../render/magnifier';
import { Viewport, type Rect } from '../render/viewport';
import { instrumentBounds, SCALE_EDGE, scaleFocusBounds, sliderLength } from '../render/vernierLayout';
import { onDrag } from '../input/pointer';
import { attachPanZoom } from '../input/gestures';
import { vernierKeyAction } from '../input/keyboard';
import { createStore, changed } from '../ui/store';
import { h, holdButton, iconButton, isTypingTarget, segmented, select, tabs, toggle } from '../ui/controls';
import { icons } from '../ui/icons';
import { t } from '../ui/i18n';
import { createReadout, fmtLen, fmtSigned, fmtTrue } from '../ui/readoutPanel';
import { applyTheme, createShell, flashStatus } from '../ui/shell';
import { prefsControls, randomSeed, seedControls, zeroControls, zeroFromQuery } from '../ui/common';
import { savePrefs } from '../ui/prefs';
import { EXPLORE_FLAGS, type LabAdapter, type LabSnapshot, type ModeFlags } from '../ui/lab';
import { createModeTab } from '../ui/modeTab';
import { createPresentation } from '../ui/presentationMode';
import { vernierDemo } from '../ui/demoScripts';
import { prefersReducedMotion, tween } from '../ui/anim';
import {
  constrainGap,
  defaultDimension,
  derive,
  initialState,
  objectFor,
  OBJECT_KINDS,
  placementFor,
  startingGap,
  zeroOffsetFor,
  type Magnification,
  type VernierState,
} from '../ui/vernierModel';

// ── State ────────────────────────────────────────────────────────────────────

/** URL parameters let a teacher (or the screenshot script) open a ready-made setup. */
function stateFromUrl(): VernierState {
  const q = new URLSearchParams(location.search);
  const seed = q.has('seed') ? codeToSeed(q.get('seed')!) : randomSeed();
  let s = initialState(seed);
  const preset = q.get('preset') as VernierPresetId | null;
  if (preset && preset in VERNIER_PRESETS) s.presetId = preset;
  const unit = q.get('unit');
  if (unit === 'mm' || unit === 'cm') s.unit = unit;
  const z = zeroFromQuery(q);
  if (z) s.zeroSettings = z;
  s.zeroOffsetMm = zeroOffsetFor(s.seed, s.zeroSettings, VERNIER_PRESETS[s.presetId]);
  const obj = q.get('obj') as VernierObjectKind | null;
  if (obj && (OBJECT_KINDS as readonly string[]).includes(obj)) {
    s.objectKind = obj;
    const dim = q.get('dim');
    s.dimId = dim && objectFor(seed, obj).dimensions.some((d) => d.id === dim) ? dim : defaultDimension(obj);
    s.gapMm = startingGap(s);
  }
  if (q.has('gap')) s = { ...s, gapMm: constrainGap(s, Number(q.get('gap'))) };
  if (q.get('touch') === '1') s = { ...s, gapMm: constrainGap(s, s.objectKind && derive(s).contact === 'outer' ? 0 : 1e6) };
  if (window.innerWidth < 600) s.loupeMag = 4;
  if (q.has('mag')) s.loupeMag = (Number(q.get('mag')) as Magnification) || 6;
  if (q.has('loupe')) s.loupeOn = q.get('loupe') !== '0';
  if (q.has('aids')) s.aids = q.get('aids') !== '0';
  if (q.has('true')) s.showTrue = q.get('true') === '1';
  const lo = q.get('lo');
  if (lo === 'auto') {
    const d = derive(s);
    s.loupeOffsetMm = d.reading.vsr * vsd(d.config);
  } else if (lo !== null) s.loupeOffsetMm = Number(lo);
  else s.loupeOffsetMm = vernierSpanMm(VERNIER_PRESETS[s.presetId]) / 2;
  const theme = q.get('theme');
  if (theme === 'dark' || theme === 'contrast' || theme === 'light') s.theme = theme;
  return s;
}

const store = createStore<VernierState>(stateFromUrl());
const S = () => store.get();

interface UiState extends ModeFlags {
  candidates: boolean;
  worked: boolean;
  bold: boolean;
  /** Guided LC activity: highlight vernier marks 0…k. */
  span: number | null;
}
const ui = createStore<UiState>({ ...EXPLORE_FLAGS, candidates: false, worked: false, bold: false, span: null });
const U = () => ui.get();

// ── Page structure ───────────────────────────────────────────────────────────

const shell = createShell(t.vernierTitle, 'vernier');
applyTheme(S().theme);
initAudio();

const stageSvg = svg('svg', {
  class: 'stage-svg',
  tabindex: 0,
  role: 'slider',
  'aria-label': t.sliderLabel,
  'aria-valuemin': 0,
  'aria-roledescription': 'vernier slider',
  'aria-describedby': 'kbd-help',
});
stageSvg.append(buildDefs());
const view = createVernierView(VERNIER_PRESETS[S().presetId]);
const spanLayer = svg('g', { class: 'guided-span', 'pointer-events': 'none' });
view.scene.append(spanLayer);
stageSvg.append(view.scene);

const overlay = svg('svg', { class: 'stage-overlay', 'aria-hidden': 'true' });
const loupe = createLoupe('vernier-scene');
overlay.append(loupe.root);

shell.stage.prepend(stageSvg, overlay);
shell.stage.append(h('p', { id: 'kbd-help', class: 'kbd-help' }, [t.keyboardHelp]));

const vp = new Viewport(stageSvg);

// ── Derived helpers ──────────────────────────────────────────────────────────

function objectSpec(s: VernierState): VernierObjectSpec | null {
  const d = derive(s);
  if (!d.object || d.objectSizeMm === null) return null;
  return { obj: d.object, dimId: s.dimId, sizeMm: d.objectSizeMm, placement: s.placement, gapMm: s.gapMm, touching: d.touching };
}

function highlightFor(s: VernierState): HighlightSpec | null {
  const u = U();
  const on = u.worked || (s.aids && u.aidsAllowed);
  if (!on && !u.candidates) return null;
  const d = derive(s);
  const c = d.config;
  // Highlight the line the reading uses (VSR). When marks 0 and N coincide
  // equally (k = N rollover), this is mark 0 — the one students are taught to read.
  const r = d.reading;
  const spec: HighlightSpec = { vernierX: d.xMm + r.vsr * vsd(c), mainX: (r.mainIndex + c.gamma * r.vsr) * c.msd, vernierIndex: r.vsr };
  if (u.candidates) {
    spec.candidates = r.misalignments.map((m) => ({
      x: d.xMm + m.k * vsd(c),
      label: `${m.k}: ${m.deltaMm >= 0 ? '+' : '−'}${Math.abs(m.deltaMm).toFixed(3)} mm`,
    }));
  }
  if (!on) {
    // Candidates only (Practice "close" hint): no answer line.
    spec.vernierX = NaN;
  }
  return spec;
}

function fitRect(s: VernierState): Rect {
  const b = instrumentBounds();
  const ext = objectExtent(objectSpec(s));
  const x2 = Math.max(b.x + b.w, ext.maxX);
  const y1 = Math.min(b.y, ext.minY);
  const y2 = Math.max(b.y + b.h, ext.maxY);
  return { x: b.x, y: y1, w: x2 - b.x, h: y2 - y1 };
}

/** Default view: jaws + scales, or ~4 cm of scale on a phone (SPEC §9.2). */
function defaultRect(s: VernierState): Rect {
  const b = instrumentBounds();
  if (vp.width < 600) {
    const x = derive(s).xMm;
    return { x: Math.max(-22, x - 18), y: -4, w: 40, h: 36 };
  }
  const ext = objectExtent(objectSpec(s));
  const right = Math.max(95, s.gapMm + sliderLength(VERNIER_PRESETS[s.presetId]) + 12, ext.maxX);
  const y1 = Math.min(b.y, ext.minY);
  const y2 = Math.max(b.y + b.h, Math.min(ext.maxY, b.y + b.h + 20));
  return { x: -25, y: y1, w: right + 25, h: y2 - y1 };
}

function focusRect(s: VernierState): Rect {
  return scaleFocusBounds(derive(s).xMm, VERNIER_PRESETS[s.presetId]);
}

// ── Rendering ────────────────────────────────────────────────────────────────

const readout = createReadout(
  [
    { key: 'config', label: t.rConfig, tip: t.tipConfig },
    { key: 'lc', label: t.rLc, tip: t.tipLc },
    { key: 'msr', label: t.rMsr, tip: t.tipMsr },
    { key: 'vsr', label: t.rVsr, tip: t.tipVsr },
    { key: 'vsrlc', label: t.rVsrLc, tip: t.tipVsrLc },
    { key: 'observed', label: t.rObserved, tip: t.tipObserved, emphasis: true },
    { key: 'ze', label: t.rZe, tip: t.tipZe },
    { key: 'zc', label: t.rZc, tip: t.tipZc },
    { key: 'corrected', label: t.rCorrected, tip: t.tipCorrected, emphasis: true },
    { key: 'true', label: t.rTrue, tip: t.tipTrue },
  ],
  t.rFormula,
);
const readoutHidden = h('p', { class: 'hint readout-hidden' }, [t.readoutHidden]);

function zeText(s: VernierState): string {
  const d = derive(s);
  const { ze } = d;
  const lcTxt = fmtLen(d.lcMm, s.unit, d.lcMm);
  if (ze.kind === 'none') return `${fmtLen(0, s.unit, d.lcMm)} (${t.zeNone.toLowerCase()})`;
  const rule = ze.kind === 'positive' ? `+${ze.n} × ${lcTxt}` : `−(${ze.N} − ${ze.n}) × ${lcTxt}`;
  return `${fmtSigned(ze.zeMm, s.unit, d.lcMm)}  [n = ${ze.n}: ${rule}]`;
}

function renderReadout(s: VernierState): void {
  const d = derive(s);
  const u = s.unit;
  const lc = d.lcMm;
  const r = d.reading;
  const observed = fmtLen(r.observedMm, u, lc);
  const corrected = fmtLen(d.correctedMm, u, lc);
  readout.set(
    {
      config: `${d.config.n} VSD = ${d.config.gamma * d.config.n - 1} MSD`,
      lc: `${fmtLen(lc, u, lc)}  (= ${fmtLen(lc, 'mm', lc)})`,
      msr: fmtLen(r.msrMm, u, lc),
      vsr: String(r.vsr),
      vsrlc: `${r.vsr} × ${fmtLen(lc, u, lc)} = ${fmtLen(r.vsr * lc, u, lc)}`,
      observed,
      ze: zeText(s),
      zc: fmtSigned(d.ze.correctionMm, u, lc),
      corrected,
      true: `${fmtTrue(s.gapMm, u)} (${t.rTrueGap})`,
    },
    U().hideReadout ? '' : `${t.rObserved} ${observed}. ${t.rCorrected} ${corrected}.`,
  );
  readout.setVisible('true', s.showTrue && !U().hideReadout);
  readout.el.hidden = U().hideReadout;
  readoutHidden.hidden = !U().hideReadout;
  stageSvg.setAttribute('aria-valuemax', String(maxGapMm(d.config)));
  if (U().hideAriaReading) {
    // Practice: describe the jaws without giving the answer away (SPEC §12).
    stageSvg.setAttribute('aria-valuenow', String(Math.round(s.gapMm)));
    stageSvg.setAttribute('aria-valuetext', d.touching ? t.ariaTouching : d.object ? t.ariaFree : s.gapMm < 1e-9 ? t.ariaClosed : t.ariaFree);
  } else {
    stageSvg.setAttribute('aria-valuenow', String(r.observedMm));
    stageSvg.setAttribute('aria-valuetext', t.ariaReading(observed));
  }
}

function renderSpan(s: VernierState): void {
  spanLayer.replaceChildren();
  const k = U().span;
  if (k === null) return;
  const d = derive(s);
  const c = d.config;
  const ticks = vernierTicks(d.xMm, c);
  const x0 = d.xMm;
  const x1 = ticks[Math.max(0, Math.min(c.n, k))]!.posMm;
  const col = '#1971c2';
  spanLayer.append(
    svg('rect', { x: n4(x0), y: SCALE_EDGE + 0.1, width: n4(Math.max(0, x1 - x0)), height: 3.4, fill: col, opacity: 0.22 }),
    svg('rect', { x: n4(x0), y: SCALE_EDGE - 4.6, width: n4(Math.max(0, x1 - x0)), height: 4.5, fill: '#2f9e44', opacity: 0.2 }),
    svg('path', { d: `M${n4(x1)} ${SCALE_EDGE - 6}V${SCALE_EDGE + 4.5}`, stroke: col, 'stroke-width': 0.14 }),
    svg('path', { d: `M${n4(x0)} ${SCALE_EDGE - 6}V${SCALE_EDGE + 4.5}`, stroke: col, 'stroke-width': 0.14 }),
  );
}

/** Teacher's on/off choice; remembered so the lab opens the same way next time. */
function setLoupeOn(on: boolean): void {
  savePrefs({ loupe: on });
  store.set({ loupeOn: on });
}

function loupeFocus(s: VernierState): { x: number; y: number } {
  const x = s.loupePinned ? s.loupePinnedX : derive(s).xMm + s.loupeOffsetMm;
  return { x, y: SCALE_EDGE + 0.4 };
}

function renderLoupe(s: VernierState): void {
  const f = loupeFocus(s);
  const p = vp.worldToScreen(f.x, f.y);
  const radius = Math.max(95, Math.min(170, Math.min(vp.width, vp.height) * (vp.width < 600 ? 0.3 : 0.2)));
  loupe.update({
    visible: s.loupeOn,
    focusX: f.x,
    focusY: f.y,
    screenX: p.x,
    screenY: p.y,
    viewScale: vp.scale,
    magnification: s.loupeMag,
    radius,
    pinned: s.loupePinned,
  });
}

let lastObjectKey = '';
let sized = false;
let wasTouching = derive(S()).touching;
function render(s: VernierState, prev: VernierState | null): void {
  if (!prev || changed(s, prev, 'presetId')) view.setConfig(VERNIER_PRESETS[s.presetId]);
  if (!prev || changed(s, prev, 'theme')) applyTheme(s.theme);
  view.update({ gapMm: s.gapMm, zeroOffsetMm: s.zeroOffsetMm, locked: s.locked, highlight: highlightFor(s), boldTicks: U().bold });
  const spec = objectSpec(s);
  const key = spec ? `${s.objectKind}|${s.dimId}|${spec.sizeMm}|${spec.touching}|${s.placementCount}|${s.seed}` : 'none';
  if (key !== lastObjectKey) {
    drawVernierObject(view.objectBack, view.objectFront, spec);
    lastObjectKey = key;
  }
  // Jaw contact: soft "tock" (SPEC §11).
  const touching = derive(s).touching;
  if (touching && !wasTouching && prev && changed(s, prev, 'gapMm')) sfx.contact();
  wasTouching = touching;
  // A new object or dimension may need a different framing.
  if (prev && sized && changed(s, prev, 'objectKind', 'dimId', 'seed')) {
    vp.setFitRect(fitRect(s));
    vp.show(defaultRect(s));
  }
  renderSpan(s);
  renderLoupe(s);
  renderReadout(s);
  syncControls(s);
}

// ── Interaction: slider, object, loupe, lock ────────────────────────────────

let dragStart = { x: 0, gap: 0 };
onDrag(view.slider, {
  start(e) {
    if ((e.target as Element).closest('.lock-screw')) return false;
    if (S().locked) {
      flashStatus(shell.status, t.locked);
      return false;
    }
    anim?.cancel();
    dragStart = { x: vp.clientToWorld(e.clientX, e.clientY).x, gap: S().gapMm };
    view.slider.style.cursor = 'grabbing';
  },
  move(e) {
    const wx = vp.clientToWorld(e.clientX, e.clientY).x;
    const k = S().fine ? 0.1 : 1;
    store.set((s) => ({ gapMm: constrainGap(s, dragStart.gap + (wx - dragStart.x) * k) }));
  },
  end() {
    view.slider.style.cursor = 'grab';
  },
});

let objStart = { x: 0, y: 0, angle: 0, along: 0.5, moved: false };
onDrag(view.objectFront, {
  start(e) {
    if (!S().objectKind) return false;
    const p = vp.clientToLocal(e.clientX, e.clientY);
    objStart = { x: p.x, y: p.y, angle: S().placement.angleDeg, along: S().placement.along, moved: false };
  },
  move(e) {
    const p = vp.clientToLocal(e.clientX, e.clientY);
    const angleDeg = (((objStart.angle + (p.x - objStart.x) * 0.6) % 180) + 180) % 180;
    const along = Math.min(0.9, Math.max(0.1, objStart.along + (p.y - objStart.y) * 0.004));
    objStart.moved = true;
    store.set((s) => {
      const next = { ...s, placement: { ...s.placement, angleDeg, along } };
      return { placement: next.placement, gapMm: constrainGap(next, s.gapMm) };
    });
  },
  end() {
    // A drag counts as a reposition (Experiment mode checks this).
    if (objStart.moved) store.set((s) => ({ placementCount: s.placementCount + 1 }));
  },
});

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

view.lockScrew.addEventListener('pointerdown', (e) => e.stopPropagation());
view.lockScrew.addEventListener('click', () => toggleLock());

function toggleLock(): void {
  store.set((s) => ({ locked: !s.locked }));
  sfx.lock();
}

function moveBy(mm: number): void {
  if (S().locked) {
    flashStatus(shell.status, t.locked);
    return;
  }
  anim?.cancel();
  store.set((s) => ({ gapMm: constrainGap(s, s.gapMm + mm) }));
}

let anim: { cancel(): void } | null = null;
function animateGap(target: number, ms = 700): Promise<void> {
  anim?.cancel();
  if (S().locked) return Promise.resolve();
  const from = S().gapMm;
  return new Promise((resolve) => {
    anim = tween(prefersReducedMotion() ? 0 : ms, (k) => store.set((s) => ({ gapMm: constrainGap(s, from + (target - from) * k) })), resolve);
  });
}

/** Close onto the object: outer jaws close, inner jaws and depth rod open, until contact. */
function closeOnObject(): Promise<void> {
  const d = derive(S());
  const target = constrainGap(S(), d.contact === 'outer' || !d.contact ? 0 : 1e6);
  return animateGap(target, 900);
}

attachPanZoom(stageSvg, vp);

// Arrow keys move the slider only while the instrument has focus (elsewhere they
// drive tabs and radio groups). Letter shortcuts work anywhere on the page
// except while typing into a field — handy for a presenter. Presentation mode
// handles its own keys first and marks them with preventDefault.
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  const target = e.target as Element;
  if (isTypingTarget(target)) return;
  const a = vernierKeyAction(e);
  if (!a) return;
  if (a.type === 'move' && target !== stageSvg) return;
  e.preventDefault();
  switch (a.type) {
    case 'move':
      moveBy(a.mm);
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
      vp.show(fitRect(S()));
      break;
    case 'focus':
      vp.show(focusRect(S()));
      break;
    case 'reset':
      vp.show(defaultRect(S()));
      break;
  }
});

// ── Stage toolbar & dock ─────────────────────────────────────────────────────

shell.toolbar.append(
  iconButton(icons.zoomIn, t.cZoomIn, () => vp.zoomAt(1.25)),
  iconButton(icons.zoomOut, t.cZoomOut, () => vp.zoomAt(0.8)),
  iconButton(icons.reset, t.cReset, () => vp.show(defaultRect(S()))),
  iconButton(icons.fit, t.cFit, () => vp.show(fitRect(S()))),
  iconButton(icons.focus, t.cFocus, () => vp.show(focusRect(S()))),
);

const nudgeStep = (dir: 1 | -1) => (fast: boolean) => moveBy(dir * (fast ? 0.05 : 0.01));
const lockBtn = iconButton(icons.lock, t.cLockTitle, toggleLock, { text: t.cLock, cls: 'btn-dock' });
const fineBtn = iconButton(icons.fine, t.cFineTitle, () => store.set((s) => ({ fine: !s.fine })), { text: t.cFine, cls: 'btn-dock' });
const loupeBtn = iconButton(icons.loupe, t.cLoupe, () => setLoupeOn(!S().loupeOn), { text: t.cLoupeText, cls: 'btn-dock' });
const pinBtn = iconButton(
  icons.pin,
  t.cPin,
  () =>
    store.set((s) => (s.loupePinned ? { loupePinned: false, loupeOffsetMm: loupeFocus(s).x - derive(s).xMm } : { loupePinned: true, loupePinnedX: loupeFocus(s).x })),
  { cls: 'btn-dock' },
);
const closeBtn = iconButton(icons.close, t.cClose, () => moveBy(-1e6), { text: t.cClose, cls: 'btn-dock' });
shell.dock.append(
  closeBtn,
  loupeBtn,
  pinBtn,
  fineBtn,
  lockBtn,
  holdButton(icons.left, t.cNudgeLeft, nudgeStep(-1), 'btn-dock btn-nudge'),
  holdButton(icons.right, t.cNudgeRight, nudgeStep(1), 'btn-dock btn-nudge'),
);

// ── Side panel ───────────────────────────────────────────────────────────────

const objLabels: Record<VernierObjectKind, string> = {
  bob: t.objBob,
  cylinder: t.objCylinder,
  beaker: t.objBeaker,
  block: t.objBlock,
  marble: t.objMarble,
  battery: t.objBattery,
  tube: t.objTube,
  matchbox: t.objMatchbox,
};

function setObject(kind: VernierObjectKind | null, dimId?: string): void {
  store.set((s) => {
    const dim = kind ? (dimId && objectFor(s.seed, kind).dimensions.some((d) => d.id === dimId) ? dimId : defaultDimension(kind)) : s.dimId;
    const next: VernierState = { ...s, objectKind: kind, dimId: dim, placement: DEFAULT_PLACEMENT, placementCount: 0, locked: false };
    return { ...next, gapMm: kind ? startingGap(next) : constrainGap(next, Math.max(s.gapMm, 10)) };
  });
}

const objectSelect = select<string>(
  t.tabObjects,
  [{ value: 'none', label: t.objNone }, ...OBJECT_KINDS.map((k) => ({ value: k, label: objLabels[k] }))],
  S().objectKind ?? 'none',
  (v) => setObject(v === 'none' ? null : (v as VernierObjectKind)),
);
const dimSelect = h('select', { id: 'dim-select' });
const dimField = h('div', { class: 'field' }, [h('label', { for: 'dim-select' }, [t.objMeasure]), dimSelect]);
dimSelect.addEventListener('change', () => {
  store.set((s) => {
    const next = { ...s, dimId: dimSelect.value, locked: false };
    return { ...next, gapMm: startingGap(next) };
  });
});
const jawHint = h('p', { class: 'hint' });
function reposition(): void {
  store.set((s) => {
    const count = s.placementCount + 1;
    const next = { ...s, placementCount: count, placement: placementFor(s.seed, count, s.placement) };
    return { placementCount: count, placement: next.placement, gapMm: constrainGap(next, s.gapMm) };
  });
}
const repositionBtn = iconButton(icons.rotate, t.objReposition, reposition, { text: t.objReposition, cls: 'btn-wide' });
const objectsPanel = h('div', {}, [objectSelect.el, dimField, jawHint, repositionBtn, h('p', { class: 'hint' }, [t.objRepositionHint]), h('p', { class: 'hint' }, [t.objHint])]);

const presetSelect = select<VernierPresetId>(
  t.sPreset,
  (Object.keys(VERNIER_PRESETS) as VernierPresetId[]).map((id) => ({ value: id, label: VERNIER_PRESETS[id].label })),
  S().presetId,
  (id) =>
    store.set((s) => {
      const c = VERNIER_PRESETS[id];
      const next = { ...s, presetId: id, zeroOffsetMm: zeroOffsetFor(s.seed, s.zeroSettings, c), loupeOffsetMm: vernierSpanMm(c) / 2 };
      return { ...next, gapMm: constrainGap(next, s.gapMm) };
    }),
);
const unitSeg = segmented<LengthUnit>(t.sUnit, [{ value: 'cm', label: 'cm' }, { value: 'mm', label: 'mm' }], S().unit, (u) => store.set({ unit: u }));
function setZero(settings: ZeroErrorSettings): void {
  store.set((s) => ({ zeroSettings: settings, zeroOffsetMm: zeroOffsetFor(s.seed, settings, VERNIER_PRESETS[s.presetId]) }));
}
const zeCtl = zeroControls(() => S().zeroSettings, setZero, 9);
const aidsToggle = toggle(t.sAids, S().aids, (on) => store.set({ aids: on }));
const trueToggle = toggle(t.sShowTrue, S().showTrue, (on) => store.set({ showTrue: on }));
const magSeg = segmented<string>(t.sMagnification, [{ value: '4', label: '4×' }, { value: '6', label: '6×' }, { value: '8', label: '8×' }], String(S().loupeMag), (v) =>
  store.set({ loupeMag: Number(v) as Magnification }),
);
const loupeToggle = toggle(t.sMagnifier, S().loupeOn, setLoupeOn);
const prefsCtl = prefsControls((th) => store.set({ theme: th }));
function applySeed(seed: number): void {
  store.set((s) => {
    const next = { ...s, seed, zeroOffsetMm: zeroOffsetFor(seed, s.zeroSettings, VERNIER_PRESETS[s.presetId]), placementCount: 0, placement: DEFAULT_PLACEMENT };
    return { ...next, gapMm: next.objectKind ? startingGap(next) : s.gapMm };
  });
}
const seedCtl = seedControls(() => S().seed, applySeed, shell.status);

const settingsPanel = h('div', {}, [presetSelect.el, unitSeg.el, zeCtl.el, aidsToggle.el, loupeToggle.el, magSeg.el, trueToggle.el, prefsCtl.el, seedCtl.el]);

// ── Adapter for the modes ────────────────────────────────────────────────────

function snapshot(): LabSnapshot {
  const s = S();
  const d = derive(s);
  return {
    instrument: 'vernier',
    unit: s.unit,
    lcMm: d.lcMm,
    N: d.config.n,
    msdMm: d.config.msd,
    gamma: d.config.gamma,
    configKey: d.config.id,
    configLabel: d.config.label,
    msrMm: d.reading.msrMm,
    vsr: d.reading.vsr,
    observedMm: d.reading.observedMm,
    ze: d.ze,
    correctedMm: d.correctedMm,
    trueMm: s.gapMm,
    objectKind: s.objectKind,
    dimId: s.objectKind ? s.dimId : '',
    touching: d.touching || (!d.object && s.gapMm < 1e-9),
    closed: !d.object && s.gapMm < 1e-9,
    placementKey: `${s.objectKind}:${s.dimId}:${s.placementCount}`,
    direction: null,
    halfMmVisible: false,
    compressionMm: 0,
    locked: s.locked,
  };
}

const derivedFor: Record<VernierObjectKind, LabAdapter['objects'][number]['derived']> = {
  bob: 'sphereVolume',
  cylinder: 'cylinderVolume',
  beaker: 'beakerVolume',
  block: 'blockVolume',
  marble: 'sphereVolume',
  battery: 'cylinderVolume',
  tube: 'tubeVolume',
  matchbox: 'blockVolume',
};

const adapter: LabAdapter = {
  instrument: 'vernier',
  title: t.vernierTitle,
  objects: OBJECT_KINDS.map((k) => ({
    kind: k,
    label: objLabels[k],
    dims: objectFor(S().seed, k).dimensions.map((d) => ({ id: d.id, label: d.label, symbol: d.symbol })),
    derived: derivedFor[k],
    aimNoun: t.aimNoun[k] ?? objLabels[k],
  })),
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
  setObject: (kind, dimId) => setObject(kind as VernierObjectKind | null, dimId),
  setZeroSettings: setZero,
  zeroSettings: () => S().zeroSettings,
  reposition,
  showCandidates: (on) => ui.set({ candidates: on }),
  showWorked: (on) => ui.set({ worked: on }),
  setAids: (on) => store.set({ aids: on }),
  setLocked: (on) => store.set({ locked: on }),
  setLoupe: (on) => store.set({ loupeOn: on }),
  view: (k) => vp.show(k === 'fit' ? fitRect(S()) : k === 'scale' ? focusRect(S()) : defaultRect(S())),
  animateGap,
  closeOnObject,
  setBold: (on) => ui.set({ bold: on }),
  flash: (text) => flashStatus(shell.status, text, 2600),
  seed: () => S().seed,
  guided: {
    setSpan: (k) => ui.set({ span: k }),
    vernierIndexAt(clientX, clientY) {
      const w = vp.clientToWorld(clientX, clientY);
      const d = derive(S());
      if (w.y < SCALE_EDGE - 6 || w.y > SCALE_EDGE + 7) return null;
      const k = Math.round((w.x - d.xMm) / vsd(d.config));
      return k >= 0 && k <= d.config.n ? k : null;
    },
    alignZero() {
      // Put the vernier zero exactly on the 10 mm mark (whatever the zero error),
      // and lock the slider so hovering / tapping the scale cannot move it.
      store.set((s) => ({ locked: true, gapMm: constrainGap({ ...s, objectKind: null }, 10 - s.zeroOffsetMm), objectKind: null }));
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

const presentation = createPresentation(adapter, shell.stage, vernierDemo(), {
  beforeEnter() {
    modeTab.select('explore');
    panelTabs.select(0);
  },
  theme: (th) => store.set({ theme: th }),
});
shell.toolbar.append(iconButton(icons.present, t.modePresentation + ' (P)', () => presentation.toggle(), { cls: 'btn-present' }));

function syncControls(s: VernierState): void {
  // Rebuild the lock button only when the state changes (this runs every frame while dragging).
  if (lockBtn.getAttribute('aria-pressed') !== String(s.locked)) {
    lockBtn.innerHTML = s.locked ? icons.lock : icons.unlock;
    lockBtn.append(h('span', { class: 'btn-text' }, [s.locked ? t.cUnlock : t.cLock]));
    lockBtn.setAttribute('aria-pressed', String(s.locked));
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
  aidsToggle.set(s.aids);
  aidsToggle.el.hidden = !U().aidsAllowed;
  trueToggle.set(s.showTrue);
  trueToggle.el.hidden = U().hideReadout;
  loupeToggle.set(s.loupeOn);
  magSeg.set(String(s.loupeMag));
  prefsCtl.sync(s.theme);
  seedCtl.sync(s.seed);
  objectSelect.set(s.objectKind ?? 'none');
  // Dimension choices for the current object.
  const obj = s.objectKind ? objectFor(s.seed, s.objectKind) : null;
  dimField.hidden = !obj || obj.dimensions.length < 2;
  repositionBtn.disabled = !obj;
  if (obj) {
    const sig = obj.dimensions.map((d) => d.id).join(',');
    if (dimSelect.dataset.sig !== sig) {
      dimSelect.replaceChildren(...obj.dimensions.map((d) => h('option', { value: d.id }, [d.label])));
      dimSelect.dataset.sig = sig;
    }
    dimSelect.value = s.dimId;
    const jaw = getDimension(obj, s.dimId).jaw;
    jawHint.textContent = jaw === 'inner' ? t.jawInner : jaw === 'depth' ? t.jawDepth : t.jawOuter;
  } else {
    jawHint.textContent = '';
  }
  shell.stage.classList.toggle('is-locked', s.locked);
}

// ── Boot ─────────────────────────────────────────────────────────────────────

store.subscribe((s, prev) => render(s, prev));
ui.subscribe(() => render(S(), S()));
vp.onChange(() => renderLoupe(S()));

new ResizeObserver(() => {
  const r = stageSvg.getBoundingClientRect();
  vp.setSize(r.width, r.height);
  overlay.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  vp.setFitRect(fitRect(S()));
  if (!sized) {
    sized = true;
    const q = new URLSearchParams(location.search).get('view');
    vp.show(q === 'fit' ? fitRect(S()) : q === 'scale' ? focusRect(S()) : defaultRect(S()));
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

// Debug/automation hook (used by the screenshot script; harmless otherwise).
(window as unknown as { __lab: unknown }).__lab = { store, ui, vp, adapter, modeTab, presentation, derive: () => derive(S()) };
