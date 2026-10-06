/**
 * SVG rendering of the vernier callipers (SPEC §10.1).
 *
 * Static parts (beam, main scale, fixed jaws) are built once per config.
 * While dragging, only the slider group's transform, the depth-rod width and
 * the highlight aids change. The vernier scale is a sub-group of the slider,
 * offset by the zero error e (the engraving is "off" relative to the jaw).
 *
 * Every tick position comes from core/vernier/geometry — nothing is hand-placed.
 */
import { leastCount, vsd, type VernierConfig } from '../core/vernier/config';
import { mainTicks, vernierTicks, type Tick } from '../core/vernier/geometry';
import { formatLength } from '../core/units';
import { MAT } from './materials';
import { n4, polygonPath, roundedPath, setAttrs, svg, translate } from './svgUtils';
import {
  BEAM_BOTTOM,
  BEAM_LEFT,
  BEAM_RIGHT,
  BEAM_TOP,
  BEVEL_LEFT,
  INNER_FACE_BOTTOM,
  INNER_FACE_TOP,
  INNER_TIP_W,
  LIP_TOP,
  MAIN_SCALE_END,
  OUTER_JAW_TIP,
  ROD_H,
  ROD_Y,
  SCALE_EDGE,
  sliderLength,
} from './vernierLayout';

const MAIN_TICK_H = { short: 2.2, medium: 3.2, long: 4.4 } as const;
const VERNIER_TICK_H = { short: 2.0, medium: 2.8, long: 3.6 } as const;
const ENGRAVE = '#1a1a1a';
const ENGRAVE_HI = 'rgba(255,255,255,0.75)';

export interface HighlightSpec {
  /** World x of the coinciding vernier mark and main mark. */
  vernierX: number;
  mainX: number;
  /** Physical index (0 … N) of the coinciding vernier mark. */
  vernierIndex: number;
  /** Optional candidate marks (Practice "close" hint) with their misalignments. */
  candidates?: { x: number; label: string }[];
}

export interface VernierViewState {
  gapMm: number;
  zeroOffsetMm: number;
  locked: boolean;
  highlight: HighlightSpec | null;
  /** Thicken engraving for projectors (Presentation mode). */
  boldTicks: boolean;
}

export interface VernierView {
  /** The <g id="vernier-scene"> the magnifier re-uses with <use>. */
  scene: SVGGElement;
  /** Drag targets. */
  slider: SVGGElement;
  /** Layers for objects behind / in front of the instrument parts. */
  objectBack: SVGGElement;
  objectFront: SVGGElement;
  update(s: VernierViewState): void;
  setConfig(c: VernierConfig): void;
  /** Lock-screw element (click target). */
  lockScrew: SVGGElement;
}

/** Ticks as one path: "M x edge V edge∓h" for each. */
function tickPath(ticks: Tick[], edge: number, heights: Record<Tick['size'], number>, dir: 1 | -1, offset = 0): string {
  let d = '';
  for (const t of ticks) d += `M${n4(t.posMm + offset)} ${n4(edge)}V${n4(edge + dir * heights[t.size])}`;
  return d;
}

function engravedText(x: number, y: number, text: string, size: number, anchor = 'middle', cls = 'engr'): SVGGElement {
  return svg('g', {}, [
    svg('text', { x: n4(x + size * 0.03), y: n4(y + size * 0.04), 'font-size': size, 'text-anchor': anchor, class: `${cls} engr-hi`, fill: ENGRAVE_HI }, [text]),
    svg('text', { x: n4(x), y: n4(y), 'font-size': size, 'text-anchor': anchor, class: cls, fill: ENGRAVE }, [text]),
  ]);
}

function engravedTicks(d: string, width: number): SVGGElement {
  return svg('g', { class: 'ticks', 'shape-rendering': 'geometricPrecision' }, [
    svg('path', { d, stroke: ENGRAVE_HI, 'stroke-width': width, transform: 'translate(0.05 0.05)', class: 'tick-hi' }),
    svg('path', { d, stroke: ENGRAVE, 'stroke-width': width, class: 'tick' }),
  ]);
}

/** Soft drop shadow without a blur filter: three offset, faint copies of a silhouette. */
function softShadow(d: string): SVGElement[] {
  return [
    [2.6, 4.6, 0.07],
    [1.9, 3.4, 0.09],
    [1.2, 2.2, 0.11],
  ].map(([dx, dy, op]) => svg('path', { d, fill: '#000', opacity: op!, transform: `translate(${dx} ${dy})`, 'pointer-events': 'none' }));
}

/** Vernier label font size so labels never overlap at any preset. */
function vernierLabelSize(c: VernierConfig): number {
  const spacing = vsd(c) * (c.n / 10);
  return Math.min(2.3, Math.max(1.15, spacing * 0.62));
}

export function createVernierView(config: VernierConfig): VernierView {
  const scene = svg('g', { id: 'vernier-scene' });
  const instrument = svg('g', { class: 'instrument' });
  const objectBack = svg('g', { class: 'objects-back' });
  // No blur filters anywhere on the drag path (perf, SPEC §13): soft shadows are
  // layered, offset silhouettes. Only the static beam keeps the noise texture.
  const fixedShadow = svg('g', { class: 'fixed-shadow', 'pointer-events': 'none' });
  const fixed = svg('g', { class: 'fixed-parts' });
  const rod = svg('rect', { y: ROD_Y - ROD_H / 2, height: ROD_H, fill: MAT.rod, rx: 0.3 });
  const rodTip = svg('rect', { y: ROD_Y - ROD_H / 2 - 0.15, width: 0.5, height: ROD_H + 0.3, fill: '#7b848e', rx: 0.15 });
  const slider = svg('g', { class: 'slider', style: 'cursor: grab' });
  const sliderBody = svg('g');
  const vscale = svg('g', { class: 'vernier-scale' });
  const lockScrew = svg('g', { class: 'lock-screw', style: 'cursor: pointer' });
  const lockHatch = svg('g', { class: 'lock-hatch' });
  const objectFront = svg('g', { class: 'objects-front' });
  const aids = svg('g', { class: 'aids', 'pointer-events': 'none' });

  slider.append(sliderBody, vscale, lockScrew);
  instrument.append(fixedShadow, objectBack, fixed, rod, rodTip, slider, objectFront);
  scene.append(instrument, aids);

  let cfg = config;
  let lastE = NaN;
  let lastBold = false;
  let lastLocked = false;

  function buildFixed(): void {
    fixed.replaceChildren();
    const lowerJaw = polygonPath([
      [BEAM_LEFT, BEAM_BOTTOM - 0.5],
      [0, BEAM_BOTTOM - 0.5],
      [0, 51],
      [-0.6, OUTER_JAW_TIP],
      [-4.5, 56],
      [-9.5, 45],
      [-14, 31],
      [BEAM_LEFT, 25],
    ]);
    const silhouette = `M${BEAM_LEFT} ${LIP_TOP}H0V${BEAM_TOP}H${BEAM_RIGHT}V${BEAM_BOTTOM}H${BEAM_LEFT}Z` + lowerJaw;
    fixedShadow.replaceChildren(...softShadow(silhouette));
    // Fixed head above the beam and its inner (upper) jaw — face at x = 0 facing LEFT,
    // tip body to the right of zero (it crosses the moving jaw's tip; DECISIONS D27).
    fixed.append(
      svg('path', {
        d: polygonPath([
          [-8, LIP_TOP],
          [-3, -12],
          [0, INNER_FACE_BOTTOM],
          [0, INNER_FACE_TOP],
          [0.35, INNER_FACE_TOP - 1.6],
          [INNER_TIP_W, INNER_FACE_TOP + 1],
          [INNER_TIP_W, INNER_FACE_BOTTOM],
          [-1, -10],
          [-1, LIP_TOP],
        ]),
        fill: MAT.steelJaw,
        stroke: '#5f6872',
        'stroke-width': 0.12,
      }),
      svg('path', {
        d: roundedPath(
          [
            [BEAM_LEFT, LIP_TOP],
            [0, LIP_TOP],
            [0, BEAM_TOP + 0.4],
            [BEAM_LEFT, BEAM_TOP + 0.4],
          ],
          0.8,
        ),
        fill: MAT.steelSlider,
        stroke: '#6b747e',
        'stroke-width': 0.12,
      }),
    );
    // Beam with brushed finish.
    fixed.append(
      svg('rect', { x: BEAM_LEFT, y: BEAM_TOP, width: BEAM_RIGHT - BEAM_LEFT, height: BEAM_BOTTOM - BEAM_TOP, rx: 0.6, fill: MAT.steelBeam, filter: MAT.brushed }),
      svg('path', { d: `M${BEAM_LEFT + 0.5} ${BEAM_TOP + 0.15}H${BEAM_RIGHT - 0.5}`, stroke: '#ffffff', 'stroke-opacity': 0.8, 'stroke-width': 0.2 }),
      svg('path', { d: `M${BEAM_LEFT + 0.5} ${BEAM_BOTTOM - 0.12}H${BEAM_RIGHT - 0.5}`, stroke: '#4d5660', 'stroke-opacity': 0.8, 'stroke-width': 0.2 }),
      // Beam end face.
      svg('rect', { x: BEAM_RIGHT - 0.7, y: BEAM_TOP, width: 0.7, height: BEAM_BOTTOM, fill: MAT.steelDark, rx: 0.2 }),
    );
    // Fixed outer (lower) jaw — measuring face at x = 0, knife edge at the tip.
    fixed.append(
      svg('path', {
        d: polygonPath([
          [BEAM_LEFT, BEAM_BOTTOM - 0.5],
          [0, BEAM_BOTTOM - 0.5],
          [0, 51],
          [-0.6, OUTER_JAW_TIP],
          [-4.5, 56],
          [-9.5, 45],
          [-14, 31],
          [BEAM_LEFT, 25],
        ]),
        fill: MAT.steelJaw,
        stroke: '#5f6872',
        'stroke-width': 0.12,
      }),
      // Polished measuring-face highlight.
      svg('path', { d: `M-0.12 ${BEAM_BOTTOM}V51`, stroke: '#ffffff', 'stroke-width': 0.18, 'stroke-opacity': 0.9 }),
    );
    // Main scale: 0–15 cm, ticks rising from the shared edge.
    const ticks = mainTicks(MAIN_SCALE_END, cfg.msd);
    fixed.append(engravedTicks(tickPath(ticks, SCALE_EDGE, MAIN_TICK_H, -1), 0.14));
    const labels = svg('g', { class: 'main-labels' });
    for (const t of ticks) if (t.label !== null) labels.append(engravedText(t.posMm, SCALE_EDGE - MAIN_TICK_H.long - 0.9, t.label, 2.6));
    fixed.append(labels);
    fixed.append(engravedText(MAIN_SCALE_END + 4.5, SCALE_EDGE - MAIN_TICK_H.long - 0.9, 'cm', 2.0, 'start'));
    // Engraved branding: "Riz Lab" + least count (SPEC §10.1).
    fixed.append(engravedText(BEAM_RIGHT - 3, BEAM_BOTTOM - 3.2, `Riz Lab  ${formatLength(leastCount(cfg), 'mm', leastCount(cfg))} mm`, 2.0, 'end', 'engr engr-brand'));
    fixed.append(engravedText(-10, SCALE_EDGE - 2.5, 'mm', 1.6, 'middle', 'engr engr-small'));
  }

  function buildSlider(): void {
    const L = sliderLength(cfg);
    sliderBody.replaceChildren();
    // Shadow the slider casts onto the beam.
    sliderBody.append(
      svg('rect', { x: -BEVEL_LEFT + 0.35, y: SCALE_EDGE + 0.2, width: L + BEVEL_LEFT, height: BEAM_BOTTOM - SCALE_EDGE + 0.6, fill: '#000', opacity: 0.14 }),
      svg('rect', { x: -BEVEL_LEFT + 0.7, y: SCALE_EDGE + 0.4, width: L + BEVEL_LEFT, height: BEAM_BOTTOM - SCALE_EDGE + 0.6, fill: '#000', opacity: 0.1 }),
      svg('rect', { x: 0.35, y: BEAM_TOP + 0.6, width: L, height: 0.5, fill: '#000', opacity: 0.22 }),
    );
    // Moving inner (upper) jaw — face at x = 0 facing RIGHT, tip body left of the face.
    sliderBody.append(
      svg('path', {
        d: polygonPath([
          [8, LIP_TOP],
          [3, -12],
          [0, INNER_FACE_BOTTOM],
          [0, INNER_FACE_TOP],
          [-0.35, INNER_FACE_TOP - 1.6],
          [-INNER_TIP_W, INNER_FACE_TOP + 1],
          [-INNER_TIP_W, INNER_FACE_BOTTOM],
          [1, -10],
          [1, LIP_TOP],
        ]),
        fill: MAT.steelJaw,
        stroke: '#5f6872',
        'stroke-width': 0.12,
      }),
      svg('path', { d: `M0.1 ${INNER_FACE_BOTTOM}V${INNER_FACE_TOP}`, stroke: '#fff', 'stroke-width': 0.15, 'stroke-opacity': 0.9 }),
    );
    // Top lip over the beam.
    sliderBody.append(
      svg('path', {
        d: roundedPath(
          [
            [0, LIP_TOP],
            [L, LIP_TOP],
            [L, BEAM_TOP + 0.6],
            [0, BEAM_TOP + 0.6],
          ],
          0.8,
        ),
        fill: MAT.steelSlider,
        stroke: '#5f6872',
        'stroke-width': 0.12,
      }),
    );
    // Front plate with the vernier bevel, moving outer jaw and thumb grip.
    const front: [number, number][] = [
      [-BEVEL_LEFT, SCALE_EDGE],
      [L, SCALE_EDGE],
      [L, 24],
      [L - 3, 28.5],
      [L - 17, 28.5],
      [L - 20, 24],
      [19, 24],
      [14, 31],
      [9.5, 45],
      [4.5, 56],
      [0.6, OUTER_JAW_TIP],
      [0, 51],
      [0, BEAM_BOTTOM],
      [-BEVEL_LEFT, BEAM_BOTTOM],
    ];
    const frontD = polygonPath(front);
    // Cheap two-layer drop shadow onto the bench (no blur filter on a moving part).
    sliderBody.prepend(...softShadow(frontD));
    sliderBody.append(
      svg('path', { d: frontD, fill: MAT.steelSlider, stroke: '#56606a', 'stroke-width': 0.14 }),
      svg('path', { d: frontD, fill: 'url(#mat-brush-lines)', opacity: 0.55 }),
      // Bevel: highlight + shadow line right at the scale edge (sharp, exactly aligned).
      svg('path', { d: `M${-BEVEL_LEFT} ${SCALE_EDGE + 0.06}H${L}`, stroke: '#ffffff', 'stroke-width': 0.12 }),
      svg('path', { d: `M${-BEVEL_LEFT} ${SCALE_EDGE + 0.5}H${L}`, stroke: '#7d8791', 'stroke-width': 0.1, 'stroke-opacity': 0.6 }),
      svg('path', { d: `M0.12 ${BEAM_BOTTOM}V51`, stroke: '#ffffff', 'stroke-width': 0.18, 'stroke-opacity': 0.9 }),
      // Thumb grip.
      svg('rect', { x: L - 16.2, y: 24.6, width: 12.4, height: 3.3, rx: 0.8, fill: MAT.ridges, stroke: '#606a74', 'stroke-width': 0.1, class: 'thumb-grip' }),
    );
    // LC engraved on the slider.
    sliderBody.append(engravedText(L - 2, 22.4, `LC ${formatLength(leastCount(cfg), 'mm', leastCount(cfg))} mm`, 1.4, 'end', 'engr engr-small'));
    // Locking screw (knurled head).
    const cx = Math.min(L * 0.62, L - 8);
    lockScrew.replaceChildren();
    const clipId = 'clip-lock-head';
    lockScrew.append(
      svg('clipPath', { id: clipId }, [svg('rect', { x: cx - 2.8, y: LIP_TOP - 5.6, width: 5.6, height: 5, rx: 0.9 })]),
      svg('rect', { x: cx - 1.2, y: LIP_TOP - 1, width: 2.4, height: 1.2, fill: MAT.steelDark }),
      svg('rect', { x: cx - 2.8, y: LIP_TOP - 5.6, width: 5.6, height: 5, rx: 0.9, fill: '#b5bcc3' }),
      svg('g', { 'clip-path': `url(#${clipId})` }, [lockHatch]),
      svg('rect', { x: cx - 2.8, y: LIP_TOP - 5.6, width: 5.6, height: 5, rx: 0.9, fill: 'none', stroke: '#4f5862', 'stroke-width': 0.14 }),
      svg('rect', { x: cx - 2.6, y: LIP_TOP - 5.4, width: 5.2, height: 0.7, rx: 0.3, fill: '#fff', opacity: 0.45 }),
    );
    let hatch = '';
    for (let i = -4; i <= 10; i++) hatch += `M${n4(cx - 3 + i * 0.7)} ${LIP_TOP - 6}l2 6`;
    for (let i = -4; i <= 10; i++) hatch += `M${n4(cx - 3 + i * 0.7)} ${LIP_TOP - 6}l-2 6`;
    lockHatch.replaceChildren(svg('path', { d: hatch, stroke: '#59626c', 'stroke-width': 0.18 }));
    lockHatch.style.transition = 'transform 0.35s ease-out';
  }

  function buildVernierScale(e: number, bold: boolean): void {
    const ticks = vernierTicks(0, cfg);
    vscale.replaceChildren();
    vscale.setAttribute('transform', translate(e));
    vscale.append(engravedTicks(tickPath(ticks, SCALE_EDGE, VERNIER_TICK_H, 1), bold ? 0.2 : 0.12));
    const size = vernierLabelSize(cfg);
    for (const t of ticks) {
      if (t.label !== null) vscale.append(engravedText(t.posMm, SCALE_EDGE + VERNIER_TICK_H.long + size * 0.95, t.label, size));
    }
  }

  function updateAids(h: HighlightSpec | null, bold: boolean): void {
    aids.replaceChildren();
    if (!h) return;
    const color = 'var(--coincide, #e8590c)';
    // Recolour the two marks at their REAL length and width, so the aid never
    // hides the coincidence it points at. Markers (shape, not colour alone)
    // sit beyond the tick ends; the guide is a hairline.
    const m = Math.round(h.mainX / cfg.msd);
    const mainH = MAIN_TICK_H[m % 10 === 0 ? 'long' : m % 5 === 0 ? 'medium' : 'short'];
    const vt = vernierTicks(0, cfg);
    const kIdx = Math.max(0, Math.min(cfg.n, h.vernierIndex));
    const vH = VERNIER_TICK_H[vt[kIdx]?.size ?? 'long'];
    const w = bold ? 0.24 : 0.14;
    const top = SCALE_EDGE - MAIN_TICK_H.long - 3.6;
    const bottom = SCALE_EDGE + VERNIER_TICK_H.long + 3.2;
    // vernierX = NaN: candidates only (Practice hint), no answer line.
    if (Number.isFinite(h.vernierX)) aids.append(
      svg('path', { d: `M${n4(h.mainX)} ${top}V${bottom}`, stroke: color, 'stroke-width': bold ? 0.08 : 0.04, 'stroke-dasharray': '0.35 0.35', opacity: 0.9 }),
      svg('path', { d: `M${n4(h.mainX)} ${SCALE_EDGE}V${n4(SCALE_EDGE - mainH)}`, stroke: color, 'stroke-width': w }),
      svg('path', { d: `M${n4(h.vernierX)} ${SCALE_EDGE}V${n4(SCALE_EDGE + vH)}`, stroke: color, 'stroke-width': w }),
      svg('path', { d: `M${n4(h.mainX)} ${n4(SCALE_EDGE - mainH - 0.35)}l-0.55 -1h1.1z`, fill: color }),
      svg('path', { d: `M${n4(h.vernierX)} ${n4(SCALE_EDGE + vH + 0.35)}l-0.55 1h1.1z`, fill: color }),
    );
    for (const c of h.candidates ?? []) {
      aids.append(
        svg('path', { d: `M${n4(c.x)} ${SCALE_EDGE}V${bottom}`, stroke: '#1971c2', 'stroke-width': 0.2, opacity: 0.8 }),
        svg('text', { x: n4(c.x), y: bottom + 2.6, 'font-size': 0.9, 'text-anchor': 'middle', fill: '#1971c2', class: 'ui-svg-text' }, [c.label]),
      );
    }
  }

  function setConfig(c: VernierConfig): void {
    cfg = c;
    buildFixed();
    buildSlider();
    lastE = NaN;
  }

  setConfig(config);

  return {
    scene,
    slider,
    objectBack,
    objectFront,
    lockScrew,
    setConfig,
    update(s) {
      if (s.zeroOffsetMm !== lastE || s.boldTicks !== lastBold) {
        buildVernierScale(s.zeroOffsetMm, s.boldTicks);
        lastE = s.zeroOffsetMm;
        lastBold = s.boldTicks;
      }
      slider.setAttribute('transform', translate(s.gapMm));
      setAttrs(rod, { x: n4(BEAM_RIGHT - 0.7), width: n4(Math.max(0, s.gapMm + 0.7)) });
      setAttrs(rodTip, { x: n4(BEAM_RIGHT + s.gapMm - 0.5), visibility: s.gapMm > 0.6 ? 'visible' : 'hidden' });
      if (s.locked !== lastLocked) {
        lockHatch.style.transform = s.locked ? 'translateX(0.35px)' : 'translateX(0px)';
        lastLocked = s.locked;
      }
      slider.style.cursor = s.locked ? 'not-allowed' : 'grab';
      updateAids(s.highlight, s.boldTicks);
    },
  };
}
