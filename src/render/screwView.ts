/**
 * SVG rendering of the screw gauge (SPEC §10.2).
 *
 * Static parts (frame, anvil, sleeve and its linear scale) are built once per
 * config. Each frame only these change:
 *   - the spindle group's transform (x = s),
 *   - the clip rectangle that hides sleeve marks beyond the thimble edge,
 *   - the thimble / ratchet group transforms (edge at LINEAR_ZERO + p),
 *   - the circular-scale ticks, re-projected onto the cylinder from a pool of
 *     reused DOM nodes (only the visible front half is drawn, SPEC §13),
 *   - the knurl offsets that show rotation.
 *
 * Every mark position comes from core/screw/geometry — nothing is hand-placed.
 */
import { screwLeastCount, SCREW_RANGE_MM, type ScrewConfig } from '../core/screw/config';
import { circularMarks, linearMarks, type CircularMark } from '../core/screw/geometry';
import { formatLength } from '../core/units';
import { MAT } from './materials';
import { n4, setAttrs, svg, translate } from './svgUtils';
import {
  BEVEL_W,
  CIRC_TICK,
  FRAME_L_INNER,
  FRAME_L_OUTER,
  FRAME_R_INNER,
  FRAME_R_OUTER,
  FRAME_TOP,
  GRIP_W,
  LINEAR_TICK,
  LINEAR_ZERO,
  LOCK_X,
  LOCK_Y,
  RATCHET_LEN,
  RATCHET_NECK,
  RATCHET_R,
  SLEEVE_END,
  SLEEVE_R,
  SLEEVE_START,
  SPINDLE_R,
  THIMBLE_LEN,
  THIMBLE_R,
} from './screwLayout';

const ENGRAVE = '#1a1a1a';
const ENGRAVE_HI = 'rgba(255,255,255,0.75)';

export interface ScrewHighlight {
  /** Circular division on the datum line (the CSR). */
  csr: number;
  /** PSR in mm: the sleeve mark that sets it is highlighted (if it exists, i.e. ≥ 0). */
  psrMm: number;
  /** Practice "close" hint: neighbouring divisions with labels. */
  candidates?: { j: number; label: string }[];
}

export interface ScrewViewState {
  gapMm: number;
  /** Scale position p = s + e + slack. */
  pMm: number;
  /** Visual rotation of the ratchet knob (thimble angle + slip), degrees. */
  ratchetDeg: number;
  locked: boolean;
  highlight: ScrewHighlight | null;
  boldTicks: boolean;
  /** Guided "find the pitch": a start marker on the sleeve (world x) and the division that was on the datum. */
  pitchMarker: { sleeveX: number; division: number } | null;
}

export interface ScrewView {
  scene: SVGGElement;
  thimble: SVGGElement;
  ratchet: SVGGElement;
  lockLever: SVGGElement;
  objectBack: SVGGElement;
  objectFront: SVGGElement;
  setConfig(c: ScrewConfig): void;
  update(s: ScrewViewState): void;
}

function engravedText(x: number, y: number, text: string, size: number, anchor = 'middle', cls = 'engr'): SVGGElement {
  return svg('g', {}, [
    svg('text', { x: n4(x + size * 0.03), y: n4(y + size * 0.04), 'font-size': size, 'text-anchor': anchor, class: `${cls} engr-hi`, fill: ENGRAVE_HI }, [text]),
    svg('text', { x: n4(x), y: n4(y), 'font-size': size, 'text-anchor': anchor, class: cls, fill: ENGRAVE }, [text]),
  ]);
}

function softShadow(d: string): SVGElement[] {
  return [
    [2.4, 4.2, 0.08],
    [1.7, 3.0, 0.1],
    [1.0, 1.9, 0.12],
  ].map(([dx, dy, op]) => svg('path', { d, fill: '#000', opacity: op!, transform: `translate(${dx} ${dy})`, 'pointer-events': 'none' }));
}

/** Diagonal knurl lines (both directions) that repeat every `period` mm in y. */
function knurlLines(x0: number, x1: number, half: number, period: number, cross: boolean): string {
  let d = '';
  const w = x1 - x0;
  for (let y = -half - w - period; y <= half + period; y += period) {
    d += `M${n4(x0)} ${n4(y)}l${n4(w)} ${n4(w)}`;
    if (cross) d += `M${n4(x0)} ${n4(y + w)}l${n4(w)} ${n4(-w)}`;
  }
  return d;
}

/** Where a sleeve mark of the given PSR sits (world x), if such a mark exists. */
export function psrMarkX(psrMm: number): number | null {
  if (psrMm < -1e-9 || psrMm > SCREW_RANGE_MM + 1e-9) return null;
  return LINEAR_ZERO + psrMm;
}

export function createScrewView(config: ScrewConfig): ScrewView {
  const scene = svg('g', { id: 'screw-scene' });
  const shadow = svg('g', { class: 'fixed-shadow', 'pointer-events': 'none' });
  const frame = svg('g', { class: 'frame' });
  const spindle = svg('g', { class: 'spindle' });
  const sleeve = svg('g', { class: 'sleeve' });
  const sleeveClipRect = svg('rect', { x: SLEEVE_START, y: -SLEEVE_R - 6, height: 2 * SLEEVE_R + 12, width: 10 });
  const sleeveMarks = svg('g', { class: 'sleeve-marks', 'clip-path': 'url(#clip-sleeve-uncovered)' });
  const anvil = svg('g', { class: 'anvil' });
  const objectBack = svg('g', { class: 'objects-back' });
  const objectFront = svg('g', { class: 'objects-front' });
  const thimble = svg('g', { class: 'thimble', style: 'cursor: ns-resize' });
  const thimbleKnurl = svg('path', { stroke: '#56606a', 'stroke-width': 0.16, fill: 'none' });
  const circTicks = svg('g', { class: 'circ-ticks', 'shape-rendering': 'geometricPrecision' });
  const circLabels = svg('g', { class: 'circ-labels' });
  const thimbleAids = svg('g', { class: 'aids', 'pointer-events': 'none' });
  const ratchet = svg('g', { class: 'ratchet', style: 'cursor: ns-resize' });
  const ratchetKnurl = svg('path', { stroke: '#4e5761', 'stroke-width': 0.2, fill: 'none' });
  const lockLever = svg('g', { class: 'lock-lever', style: 'cursor: pointer' });
  const leverArm = svg('g', { class: 'lever-arm' });
  const aids = svg('g', { class: 'aids', 'pointer-events': 'none' });
  const pitchMarks = svg('g', { class: 'pitch-marker', 'pointer-events': 'none' });

  scene.append(
    svg('defs', {}, [
      svg('clipPath', { id: 'clip-sleeve-uncovered' }, [sleeveClipRect]),
      svg('clipPath', { id: 'clip-thimble-grip' }, [svg('rect', { x: THIMBLE_LEN - GRIP_W, y: -THIMBLE_R, width: GRIP_W, height: 2 * THIMBLE_R })]),
      svg('clipPath', { id: 'clip-ratchet' }, [svg('rect', { x: RATCHET_NECK, y: -RATCHET_R, width: RATCHET_LEN, height: 2 * RATCHET_R, rx: 0.8 })]),
      // Roundness overlay: transparent in the middle, dark at the top and bottom.
      svg('linearGradient', { id: 'mat-cyl-shade', x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg('stop', { offset: 0, 'stop-color': '#1d232a', 'stop-opacity': 0.75 }),
        svg('stop', { offset: 0.3, 'stop-color': '#1d232a', 'stop-opacity': 0.12 }),
        svg('stop', { offset: 0.5, 'stop-color': '#ffffff', 'stop-opacity': 0.12 }),
        svg('stop', { offset: 0.7, 'stop-color': '#1d232a', 'stop-opacity': 0.12 }),
        svg('stop', { offset: 1, 'stop-color': '#1d232a', 'stop-opacity': 0.75 }),
      ]),
    ]),
    shadow,
    objectBack,
    spindle,
    frame,
    sleeve,
    anvil,
    objectFront,
    thimble,
    ratchet,
    lockLever,
    aids,
    pitchMarks,
  );

  let cfg = config;
  let lastBold: boolean | null = null;
  let lastLocked: boolean | null = null;
  const tickPool: SVGLineElement[] = [];
  const labelPool: SVGTextElement[] = [];

  // ── Static parts ──────────────────────────────────────────────────────────
  const frameD =
    `M${FRAME_L_OUTER} ${FRAME_TOP}H${FRAME_L_INNER}V3` +
    `C${FRAME_L_INNER} 27 ${FRAME_R_INNER} 27 ${FRAME_R_INNER} 3` +
    `V${FRAME_TOP}H${FRAME_R_OUTER}V6` +
    `C${FRAME_R_OUTER} 52 ${FRAME_L_OUTER} 52 ${FRAME_L_OUTER} 6Z`;

  function buildFrame(): void {
    shadow.replaceChildren(...softShadow(frameD + `M${SLEEVE_START} ${-SLEEVE_R}H${LINEAR_ZERO + 1}V${SLEEVE_R}H${SLEEVE_START}Z`));
    const lc = screwLeastCount(cfg);
    frame.replaceChildren(
      svg('path', { d: frameD, fill: MAT.enamel, stroke: '#0b1430', 'stroke-width': 0.2 }),
      // Specular streak along the curve.
      svg('path', { d: `M${FRAME_R_OUTER - 2.2} 8C${FRAME_R_OUTER - 2.2} 46 ${FRAME_L_OUTER + 2.2} 46 ${FRAME_L_OUTER + 2.2} 8`, stroke: '#cfdcff', 'stroke-opacity': 0.28, 'stroke-width': 1.1, fill: 'none' }),
      svg('path', { d: `M${FRAME_L_OUTER + 0.6} ${FRAME_TOP + 0.4}H${FRAME_L_INNER - 0.6}M${FRAME_R_INNER + 0.6} ${FRAME_TOP + 0.4}H${FRAME_R_OUTER - 0.6}`, stroke: '#e3eaff', 'stroke-opacity': 0.5, 'stroke-width': 0.35 }),
      // Bosses around the axis.
      svg('rect', { x: FRAME_L_OUTER + 1.5, y: -5.8, width: FRAME_L_INNER - FRAME_L_OUTER - 1.5, height: 11.6, rx: 1.2, fill: '#ffffff', opacity: 0.06 }),
      svg('rect', { x: FRAME_R_INNER, y: -5.8, width: FRAME_R_OUTER - FRAME_R_INNER - 1.5, height: 11.6, rx: 1.2, fill: '#ffffff', opacity: 0.06 }),
      // Painted-in engraving on the enamel ("Riz Lab" is the only name, SPEC §10.1).
      svg('text', { x: 10.5, y: 32.2, 'font-size': 3.1, 'text-anchor': 'middle', class: 'engr engr-brand', fill: '#0b1430', opacity: 0.8 }, ['Riz Lab']),
      svg('text', { x: 10.4, y: 32, 'font-size': 3.1, 'text-anchor': 'middle', class: 'engr engr-brand', fill: '#e9eefc' }, ['Riz Lab']),
      svg('text', { x: 10.4, y: 35.6, 'font-size': 1.7, 'text-anchor': 'middle', class: 'engr', fill: '#c7d2f2' }, [
        `0–${SCREW_RANGE_MM} mm   ${formatLength(lc, 'mm', lc)} mm`,
      ]),
    );
    // Anvil: polished steel, clean flat face at x = 0.
    anvil.replaceChildren(
      svg('rect', { x: FRAME_L_INNER - 0.6, y: -SPINDLE_R - 0.8, width: 1.6, height: 2 * SPINDLE_R + 1.6, rx: 0.4, fill: MAT.chromeV, stroke: '#4c555f', 'stroke-width': 0.1 }),
      svg('rect', { x: FRAME_L_INNER + 0.6, y: -SPINDLE_R, width: -FRAME_L_INNER - 0.6, height: 2 * SPINDLE_R, fill: MAT.chromeV, stroke: '#4c555f', 'stroke-width': 0.1 }),
      svg('path', { d: `M${FRAME_L_INNER + 0.8} ${-SPINDLE_R * 0.35}H-0.2`, stroke: '#ffffff', 'stroke-width': 0.5, 'stroke-opacity': 0.85 }),
      svg('path', { d: `M-0.1 ${-SPINDLE_R + 0.2}V${SPINDLE_R - 0.2}`, stroke: '#ffffff', 'stroke-width': 0.18, 'stroke-opacity': 0.9 }),
    );
    // Spindle (moves with s): face at local x = 0, runs back into the sleeve.
    spindle.replaceChildren(
      svg('rect', { x: 0, y: -SPINDLE_R, width: SLEEVE_START + 6, height: 2 * SPINDLE_R, fill: MAT.chromeV, stroke: '#4c555f', 'stroke-width': 0.1 }),
      svg('path', { d: `M0.4 ${-SPINDLE_R * 0.35}H${SLEEVE_START + 5}`, stroke: '#ffffff', 'stroke-width': 0.5, 'stroke-opacity': 0.85 }),
      svg('path', { d: `M0.1 ${-SPINDLE_R + 0.2}V${SPINDLE_R - 0.2}`, stroke: '#ffffff', 'stroke-width': 0.18, 'stroke-opacity': 0.9 }),
    );
    // Lock lever: knurled nut + arm (two visible states).
    lockLever.replaceChildren(
      svg('rect', { x: LOCK_X - 2.2, y: LOCK_Y - 2.4, width: 4.4, height: 2.6, rx: 0.5, fill: MAT.diamondKnurl, stroke: '#3c444d', 'stroke-width': 0.12 }),
      leverArm,
      svg('circle', { cx: LOCK_X, cy: LOCK_Y - 2.6, r: 0.9, fill: MAT.chromeV, stroke: '#3c444d', 'stroke-width': 0.12 }),
      // Generous invisible hit area (touch target).
      svg('rect', { x: LOCK_X - 6, y: LOCK_Y - 9, width: 12, height: 9.5, fill: 'transparent' }),
    );
    leverArm.replaceChildren(
      svg('path', { d: `M${LOCK_X - 0.7} ${LOCK_Y - 2.6}L${LOCK_X - 0.45} ${LOCK_Y - 8}Q${LOCK_X} ${LOCK_Y - 8.9} ${LOCK_X + 0.45} ${LOCK_Y - 8}L${LOCK_X + 0.7} ${LOCK_Y - 2.6}Z`, fill: '#20252b', stroke: '#0e1114', 'stroke-width': 0.1 }),
      svg('path', { d: `M${LOCK_X - 0.15} ${LOCK_Y - 3}L${LOCK_X - 0.05} ${LOCK_Y - 7.8}`, stroke: '#8d98a3', 'stroke-width': 0.18 }),
    );
  }

  function buildSleeve(bold: boolean): void {
    const marks = linearMarks(cfg);
    const w = bold ? 0.2 : 0.13;
    let dUp = '';
    let dDown = '';
    const labels = svg('g', { class: 'sleeve-labels' });
    for (const m of marks) {
      const x = LINEAR_ZERO + m.posMm;
      if (m.side === 'upper') {
        dUp += `M${n4(x)} 0V${n4(-(m.long ? LINEAR_TICK.long : LINEAR_TICK.normal))}`;
        if (m.label !== null) labels.append(engravedText(x, -LINEAR_TICK.long - 0.55, m.label, 1.5));
      } else {
        dDown += `M${n4(x)} 0V${n4(LINEAR_TICK.half)}`;
      }
    }
    const d = dUp + dDown;
    sleeveMarks.replaceChildren(
      svg('path', { d, stroke: ENGRAVE_HI, 'stroke-width': w, transform: 'translate(0.05 0.05)' }),
      svg('path', { d, stroke: ENGRAVE, 'stroke-width': w }),
      labels,
    );
    sleeve.replaceChildren(
      svg('rect', { x: SLEEVE_START, y: -SLEEVE_R, width: SLEEVE_END - SLEEVE_START, height: 2 * SLEEVE_R, fill: MAT.chromeV, stroke: '#59626c', 'stroke-width': 0.1 }),
      svg('rect', { x: SLEEVE_START, y: -SLEEVE_R, width: SLEEVE_END - SLEEVE_START, height: 2 * SLEEVE_R, fill: 'url(#mat-brush-lines)', opacity: 0.35 }),
      // Datum (reference) line along the sleeve.
      svg('path', { d: `M${SLEEVE_START + 1.2} 0.04H${SLEEVE_END}`, stroke: ENGRAVE_HI, 'stroke-width': w }),
      svg('path', { d: `M${SLEEVE_START + 1.2} 0H${SLEEVE_END}`, stroke: ENGRAVE, 'stroke-width': w, class: 'datum' }),
      sleeveMarks,
      engravedText(LINEAR_ZERO - 2.4, -LINEAR_TICK.long - 0.55, 'mm', 1.1, 'middle', 'engr engr-small'),
    );
  }

  function buildThimble(): void {
    const R = THIMBLE_R;
    const r0 = R - 0.9;
    const body = `M0 ${-r0}L${BEVEL_W} ${-R}H${THIMBLE_LEN}V${R}H${BEVEL_W}L0 ${r0}Z`;
    thimble.replaceChildren(
      // The thimble and ratchet carry their own soft shadows, so the shadow moves with them.
      ...softShadow(`${body}M${THIMBLE_LEN} -2.6H${THIMBLE_LEN + RATCHET_NECK}V2.6H${THIMBLE_LEN}Z` +
        `M${THIMBLE_LEN + RATCHET_NECK} ${-RATCHET_R}H${THIMBLE_LEN + RATCHET_NECK + RATCHET_LEN}V${RATCHET_R}H${THIMBLE_LEN + RATCHET_NECK}Z`),
      svg('path', { d: body, fill: MAT.thimble, stroke: '#4a535c', 'stroke-width': 0.12 }),
      // Bevelled front edge: darker band with a thin bright ellipse at the very edge.
      svg('path', { d: `M0 ${-r0}L${BEVEL_W} ${-R}V${R}L0 ${r0}Z`, fill: '#2a3138', opacity: 0.16 }),
      svg('ellipse', { cx: 0.32, cy: 0, rx: 0.32, ry: r0, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.12, 'stroke-opacity': 0.7 }),
      // Knurled grip band (moves with rotation).
      svg('g', { 'clip-path': 'url(#clip-thimble-grip)' }, [
        svg('rect', { x: THIMBLE_LEN - GRIP_W, y: -R, width: GRIP_W, height: 2 * R, fill: '#c3c9cf' }),
        thimbleKnurl,
        svg('rect', { x: THIMBLE_LEN - GRIP_W, y: -R, width: GRIP_W, height: 2 * R, fill: 'url(#mat-cyl-shade)' }),
      ]),
      svg('path', { d: `M${THIMBLE_LEN - GRIP_W} ${-R}V${R}`, stroke: '#59626c', 'stroke-width': 0.2 }),
      circTicks,
      circLabels,
      thimbleAids,
      // Invisible full-height hit area so the whole thimble face is draggable.
      svg('rect', { x: 0, y: -R, width: THIMBLE_LEN, height: 2 * R, fill: 'transparent' }),
    );
    ratchet.replaceChildren(
      svg('rect', { x: -0.2, y: -2.6, width: RATCHET_NECK + 0.4, height: 5.2, fill: MAT.chromeV, stroke: '#4a535c', 'stroke-width': 0.1 }),
      svg('g', { 'clip-path': 'url(#clip-ratchet)' }, [
        svg('rect', { x: RATCHET_NECK, y: -RATCHET_R, width: RATCHET_LEN, height: 2 * RATCHET_R, fill: '#c9ced3' }),
        ratchetKnurl,
        svg('rect', { x: RATCHET_NECK, y: -RATCHET_R, width: RATCHET_LEN, height: 2 * RATCHET_R, fill: 'url(#mat-cyl-shade)' }),
      ]),
      svg('rect', { x: RATCHET_NECK, y: -RATCHET_R, width: RATCHET_LEN, height: 2 * RATCHET_R, rx: 0.8, fill: 'none', stroke: '#3f4750', 'stroke-width': 0.14 }),
      // End-cap shine.
      svg('ellipse', { cx: RATCHET_NECK + RATCHET_LEN - 0.4, cy: 0, rx: 0.5, ry: RATCHET_R - 0.6, fill: MAT.chromeH, stroke: '#3f4750', 'stroke-width': 0.1 }),
      svg('rect', { x: 0, y: -RATCHET_R - 1, width: RATCHET_NECK + RATCHET_LEN + 1, height: 2 * RATCHET_R + 2, fill: 'transparent' }),
    );
    thimbleKnurl.setAttribute('d', knurlLines(THIMBLE_LEN - GRIP_W, THIMBLE_LEN, THIMBLE_R, 0.9, false));
    ratchetKnurl.setAttribute('d', knurlLines(RATCHET_NECK, RATCHET_NECK + RATCHET_LEN, RATCHET_R, 1.1, true));
    // Drop the previous config's ticks and labels, not just the pool references,
    // or the old scale stays drawn under the new one.
    circTicks.replaceChildren();
    circLabels.replaceChildren();
    tickPool.length = 0;
    labelPool.length = 0;
  }

  function line(): SVGLineElement {
    const l = svg('line', { x1: 0, stroke: ENGRAVE, 'stroke-linecap': 'butt' });
    circTicks.append(l);
    tickPool.push(l);
    return l;
  }

  function label(): SVGTextElement {
    const t = svg('text', { class: 'engr', 'font-size': 1.45, fill: ENGRAVE, dy: '0.35em' });
    circLabels.append(t);
    labelPool.push(t);
    return t;
  }

  function updateCircular(marks: CircularMark[], bold: boolean): void {
    let li = 0;
    let ti = 0;
    const k = bold ? 1.5 : 1;
    for (const m of marks) {
      const y = n4(THIMBLE_R * m.yOverR);
      const len = CIRC_TICK[m.size];
      const l = tickPool[li] ?? line();
      li += 1;
      const base = m.size === 'minor' ? 0.11 : 0.15;
      l.setAttribute('x2', String(len));
      l.setAttribute('y1', y);
      l.setAttribute('y2', y);
      l.setAttribute('stroke-width', n4(base * k * (0.3 + 0.7 * m.cos)));
      l.setAttribute('opacity', n4(0.3 + 0.7 * m.cos));
      l.style.display = '';
      if (m.label !== null) {
        const t = labelPool[ti] ?? label();
        ti += 1;
        t.setAttribute('transform', `translate(${n4(len + 0.45)} ${y}) scale(1 ${n4(m.cos)})`);
        t.setAttribute('opacity', n4(0.35 + 0.65 * m.cos));
        if (t.textContent !== m.label) t.textContent = m.label;
        t.style.display = '';
      }
    }
    for (; li < tickPool.length; li++) tickPool[li]!.style.display = 'none';
    for (; ti < labelPool.length; ti++) labelPool[ti]!.style.display = 'none';
  }

  // Highlight nodes are created once and only re-positioned each frame (SPEC §13).
  const COLOR = 'var(--coincide, #e8590c)';
  const datumGuide = svg('path', { stroke: COLOR, 'stroke-dasharray': '0.3 0.3' });
  const csrTick = svg('path', { stroke: COLOR });
  const csrMarker = svg('path', { fill: COLOR });
  const candidateLayer = svg('g');
  const psrTick = svg('path', { stroke: COLOR });
  const psrMarker = svg('path', { fill: COLOR });
  thimbleAids.append(datumGuide, csrTick, csrMarker, candidateLayer);
  aids.append(psrTick, psrMarker);
  let lastCandidates = '';

  function updateAids(s: ScrewViewState, edgeX: number, marks: CircularMark[]): void {
    const h = s.highlight;
    thimbleAids.style.display = h ? '' : 'none';
    aids.style.display = h ? '' : 'none';
    if (!h) return;
    const w = n4(s.boldTicks ? 0.26 : 0.17);
    // Datum guide extended across the thimble (hairline).
    setAttrs(datumGuide, { d: `M-1 0H${CIRC_TICK.major + 3.6}`, 'stroke-width': s.boldTicks ? 0.08 : 0.05 });
    const m = marks.find((x) => x.j === h.csr);
    if (m) {
      const y = n4(THIMBLE_R * m.yOverR);
      const len = CIRC_TICK[m.size];
      setAttrs(csrTick, { d: `M0 ${y}H${len}`, 'stroke-width': w, visibility: 'visible' });
      setAttrs(csrMarker, { d: `M${n4(len + (m.label ? 2.6 : 0.4))} ${y}l1 -0.55v1.1z`, visibility: 'visible' });
    } else {
      csrTick.setAttribute('visibility', 'hidden');
      csrMarker.setAttribute('visibility', 'hidden');
    }
    // Practice "close" hint: rarely shown, rebuilt only when it changes.
    const cands = (h.candidates ?? [])
      .map((c) => ({ c, cm: marks.find((x) => x.j === c.j) }))
      .filter((x) => x.cm);
    const key = cands.map((x) => `${x.c.j}:${x.c.label}:${n4(x.cm!.yOverR)}`).join('|');
    if (key !== lastCandidates) {
      lastCandidates = key;
      candidateLayer.replaceChildren(
        ...cands.flatMap(({ c, cm }) => {
          const y = THIMBLE_R * cm!.yOverR;
          return [
            svg('path', { d: `M0 ${n4(y)}H${CIRC_TICK.major + 6}`, stroke: '#1971c2', 'stroke-width': 0.12, opacity: 0.85 }),
            svg('text', { x: n4(CIRC_TICK.major + 6.3), y: n4(y), dy: '0.35em', 'font-size': 0.8, fill: '#1971c2', class: 'ui-svg-text' }, [c.label]),
          ];
        }),
      );
    }
    // The sleeve mark that sets the PSR (upper = whole mm, lower = half mm).
    const px = psrMarkX(h.psrMm);
    if (px !== null && px <= edgeX + 1e-6) {
      const upper = Math.abs(h.psrMm - Math.round(h.psrMm)) < 1e-6;
      const len = upper ? (Math.round(h.psrMm) % 5 === 0 ? LINEAR_TICK.long : LINEAR_TICK.normal) : LINEAR_TICK.half;
      const dir = upper ? -1 : 1;
      setAttrs(psrTick, { d: `M${n4(px)} 0V${n4(dir * len)}`, 'stroke-width': w, visibility: 'visible' });
      setAttrs(psrMarker, { d: `M${n4(px)} ${n4(dir * (len + 0.3))}l-0.5 ${dir * 0.9}h1z`, visibility: 'visible' });
    } else {
      psrTick.setAttribute('visibility', 'hidden');
      psrMarker.setAttribute('visibility', 'hidden');
    }
  }

  let lastPitchKey = '';
  function updatePitchMarker(s: ScrewViewState): void {
    const pm = s.pitchMarker;
    const key = pm ? n4(pm.sleeveX) : '';
    if (key === lastPitchKey) return;
    lastPitchKey = key;
    pitchMarks.replaceChildren();
    if (!pm) return;
    const c = '#1971c2';
    // Start position of the thimble edge on the sleeve.
    pitchMarks.append(
      svg('path', { d: `M${n4(pm.sleeveX)} ${-SLEEVE_R - 2.6}V${SLEEVE_R + 0.5}`, stroke: c, 'stroke-width': 0.14, 'stroke-dasharray': '0.4 0.3' }),
      svg('path', { d: `M${n4(pm.sleeveX)} ${-SLEEVE_R - 2.4}l-0.7 -1.2h1.4z`, fill: c }),
      svg('text', { x: n4(pm.sleeveX), y: -SLEEVE_R - 4.2, 'font-size': 1.3, 'text-anchor': 'middle', fill: c, class: 'ui-svg-text' }, ['start']),
    );
  }

  function setConfig(c: ScrewConfig): void {
    cfg = c;
    buildFrame();
    buildThimble();
    lastBold = null;
    lastLocked = null;
  }

  setConfig(config);

  return {
    scene,
    thimble,
    ratchet,
    lockLever,
    objectBack,
    objectFront,
    setConfig,
    update(s) {
      if (s.boldTicks !== lastBold) {
        buildSleeve(s.boldTicks);
        lastBold = s.boldTicks;
      }
      const edgeX = LINEAR_ZERO + s.pMm;
      spindle.setAttribute('transform', translate(s.gapMm));
      // Sleeve marks beyond the thimble edge are hidden (SPEC §6.2).
      setAttrs(sleeveClipRect, { width: n4(Math.max(0, edgeX - SLEEVE_START)) });
      thimble.setAttribute('transform', translate(edgeX));
      ratchet.setAttribute('transform', translate(edgeX + THIMBLE_LEN));
      const marks = circularMarks(s.pMm, cfg);
      updateCircular(marks, s.boldTicks);
      // Knurls: the surface moves DOWN as the gauge opens (θ increasing).
      const thimbleShift = (((s.pMm / cfg.pitch) * 2 * Math.PI * THIMBLE_R) % 0.9 + 0.9) % 0.9;
      thimbleKnurl.setAttribute('transform', `translate(0 ${n4(thimbleShift)})`);
      const ratchetShift = ((((s.ratchetDeg / 360) * 2 * Math.PI * RATCHET_R) % 1.1) + 1.1) % 1.1;
      ratchetKnurl.setAttribute('transform', `translate(0 ${n4(ratchetShift)})`);
      if (s.locked !== lastLocked) {
        leverArm.setAttribute('transform', `rotate(${s.locked ? 40 : -40} ${LOCK_X} ${LOCK_Y - 2.6})`);
        lastLocked = s.locked;
      }
      thimble.style.cursor = s.locked ? 'not-allowed' : 'ns-resize';
      ratchet.style.cursor = s.locked ? 'not-allowed' : 'ns-resize';
      updateAids(s, edgeX, marks);
      updatePitchMarker(s);
    },
  };
}
