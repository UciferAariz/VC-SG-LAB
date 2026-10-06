/**
 * Physics notes page: the small diagrams are drawn from core/ geometry and
 * their captions are computed by core/ reading functions, so the notes can
 * never disagree with the simulator.
 */
import '../styles/main.css';
import { leastCount, vsd, VERNIER_PRESETS } from '../core/vernier/config';
import { mainTicks, vernierTicks } from '../core/vernier/geometry';
import { readVernier } from '../core/vernier/reading';
import { vernierZeroError } from '../core/vernier/zeroError';
import { SCREW_PRESETS, screwLeastCount } from '../core/screw/config';
import { circularMarks, isMarkUncovered, linearMarks } from '../core/screw/geometry';
import { readScrew } from '../core/screw/reading';
import { screwZeroError } from '../core/screw/zeroError';
import { formatLength } from '../core/units';
import { n4, svg } from '../render/svgUtils';
import { applyTheme, loadPrefs } from '../ui/prefs';

applyTheme(loadPrefs().theme);

const INK = '#1a1a1a';
const HI = '#e8590c';
const SPAN = '#1971c2';
const V = VERNIER_PRESETS.standard;
const S = SCREW_PRESETS.standard;
const mm = (v: number, lc: number) => `${formatLength(v, 'mm', lc).replace(/^-/, '−')} mm`;

function frame(viewBox: string, label: string): SVGSVGElement {
  return svg('svg', { viewBox, class: 'note-fig', role: 'img', 'aria-label': label });
}

/** Main scale above, vernier below, vernier zero at x (mm). */
function vernierFigure(x: number, from: number, to: number, label: string, showSpan = false): SVGSVGElement {
  const root = frame(`${from - 1} -7 ${to - from + 2} 14`, label);
  root.append(svg('rect', { x: from - 1, y: -7, width: to - from + 2, height: 7, fill: '#dfe3e7' }));
  root.append(svg('rect', { x: Math.max(from - 1, x - 2), y: 0, width: to - Math.max(from - 1, x - 2) + 1, height: 7, fill: '#eef1f3', stroke: '#8d96a0', 'stroke-width': 0.08 }));
  let d = '';
  for (const tk of mainTicks(150, V.msd)) {
    if (tk.posMm < from || tk.posMm > to) continue;
    d += `M${tk.posMm} 0V${-(tk.size === 'long' ? 4 : tk.size === 'medium' ? 3 : 2)}`;
    if (tk.label !== null) root.append(svg('text', { x: tk.posMm, y: -4.7, 'font-size': 1.8, 'text-anchor': 'middle', fill: INK, class: 'engr' }, [tk.label]));
  }
  for (const tk of vernierTicks(x, V)) {
    d += `M${n4(tk.posMm)} 0V${tk.size === 'long' ? 3.4 : 2.6}`;
    if (tk.label !== null) root.append(svg('text', { x: n4(tk.posMm), y: 6.3, 'font-size': 1.05, 'text-anchor': 'middle', fill: INK, class: 'engr' }, [tk.label]));
  }
  root.append(svg('path', { d, stroke: INK, 'stroke-width': 0.12 }));
  if (showSpan) {
    const end = x + V.n * vsd(V);
    root.append(
      svg('rect', { x: n4(x), y: 0.1, width: n4(end - x), height: 3.2, fill: SPAN, opacity: 0.2 }),
      svg('rect', { x: n4(x), y: -4.1, width: n4(end - x), height: 4, fill: '#2f9e44', opacity: 0.2 }),
    );
  }
  const r = readVernier(x, V);
  const vx = x + r.coincidingMark * vsd(V);
  const mx = r.coincidingMainMark * V.msd;
  root.append(
    svg('path', { d: `M${n4(mx)} 0V-4.2M${n4(vx)} 0V3.4`, stroke: HI, 'stroke-width': 0.22 }),
    svg('path', { d: `M${n4(mx)} -4.6l-0.6 -1.1h1.2zM${n4(vx)} 3.8l-0.6 1.1h1.2z`, fill: HI }),
  );
  if (x < 0) root.append(svg('text', { x: from - 0.6, y: -6, 'font-size': 1.3, fill: '#4a5663' }, ['(no marks left of 0)']));
  return root;
}

/** Sleeve with the linear scale, and the thimble edge at p with its circular scale. */
function screwFigure(p: number, label: string): SVGSVGElement {
  const R = 6.5;
  const x0 = -6;
  const edge = 2 * p; // drawn at 2× along the axis so the half-mm marks are clear
  const root = frame(`${x0 - 1} -9 ${edge - x0 + 16} 18`, label);
  root.append(svg('rect', { x: x0, y: -3.6, width: edge - x0 + 1, height: 7.2, fill: '#dfe3e7', stroke: '#8d96a0', 'stroke-width': 0.08 }));
  let d = `M${x0 + 0.5} 0H${edge}`;
  for (const m of linearMarks(S, 25)) {
    if (!isMarkUncovered(m.posMm, p)) continue;
    const x = 2 * m.posMm;
    d += m.side === 'upper' ? `M${x} 0V${m.long ? -2.6 : -1.8}` : `M${x} 0V1.8`;
    if (m.label !== null) root.append(svg('text', { x, y: -3, 'font-size': 1.6, 'text-anchor': 'middle', fill: INK, class: 'engr' }, [m.label]));
  }
  root.append(svg('path', { d, stroke: INK, 'stroke-width': 0.14 }));
  root.append(svg('rect', { x: edge, y: -R, width: 14, height: 2 * R, fill: '#e9ecef', stroke: '#59626c', 'stroke-width': 0.1 }));
  const r = readScrew(p, S);
  let c = '';
  for (const m of circularMarks(p, S)) {
    const y = R * m.yOverR;
    const len = m.size === 'major' ? 2.8 : 1.6;
    c += `M${n4(edge)} ${n4(y)}h${len}`;
    if (m.label !== null) root.append(svg('text', { 'font-size': 1.5, fill: INK, class: 'engr', dy: '0.35em', transform: `translate(${n4(edge + 3.2)} ${n4(y)}) scale(1 ${n4(m.cos)})` }, [m.label]));
    if (m.j === r.csr) root.append(svg('path', { d: `M${n4(edge)} ${n4(y)}h${len}`, stroke: HI, 'stroke-width': 0.3 }));
  }
  root.append(svg('path', { d: c, stroke: INK, 'stroke-width': 0.12 }));
  root.append(svg('path', { d: `M${n4(edge - 1)} 0H${n4(edge + 7)}`, stroke: HI, 'stroke-width': 0.06, 'stroke-dasharray': '0.3 0.3' }));
  root.append(svg('text', { x: x0 + 0.4, y: -0.45, 'font-size': 1.1, fill: '#4a5663' }, ['datum']));
  return root;
}

function vernierCaption(x: number): string {
  const r = readVernier(x, V);
  const lc = leastCount(V);
  return `MSR = ${mm(r.msrMm, lc)}, vernier mark ${r.vsr} coincides: reading = ${mm(r.msrMm, lc)} + ${r.vsr} × ${mm(lc, lc)} = ${mm(r.observedMm, lc)}.`;
}

function vernierZeCaption(e: number): string {
  const z = vernierZeroError(e, V);
  const lc = leastCount(V);
  const where = z.kind === 'positive' ? 'right of' : 'left of';
  const rule = z.kind === 'positive' ? `+${z.n} × ${mm(lc, lc)}` : `−(${z.N} − ${z.n}) × ${mm(lc, lc)}`;
  return `Jaws closed. Vernier zero ${where} the main zero; mark ${z.n} coincides: ZE = ${rule} = ${z.zeMm > 0 ? '+' : ''}${mm(z.zeMm, lc)} (${z.kind}).`;
}

function screwCaption(p: number): string {
  const r = readScrew(p, S);
  const lc = screwLeastCount(S);
  return `PSR = ${mm(r.psrMm, 0.1)}${r.halfMmVisible ? ' (half-mm mark visible)' : ''}, division ${r.csr} on the datum line: reading = ${mm(r.psrMm, lc)} + ${r.csr} × ${mm(lc, lc)} = ${mm(r.observedMm, lc)}.`;
}

function screwZeCaption(e: number): string {
  const z = screwZeroError(e, S);
  const lc = screwLeastCount(S);
  const where = z.kind === 'positive' ? 'BELOW' : 'ABOVE';
  const rule = z.kind === 'positive' ? `+${z.n} × ${mm(lc, lc)}` : `−(${z.N} − ${z.n}) × ${mm(lc, lc)}`;
  return `Faces touching. Circular zero ${where} the datum line; division ${z.n} on the line: ZE = ${rule} = ${z.zeMm > 0 ? '+' : ''}${mm(z.zeMm, lc)} (${z.kind}).`;
}

const lcSpanEnd = 10 + V.n * vsd(V);
const figures: Record<string, () => [SVGSVGElement, string]> = {
  'vernier-lc': () => [
    vernierFigure(10, 3, 31, 'Ten vernier divisions span nine main-scale divisions', true),
    `The vernier zero is on the 10 mm mark. Its mark ${V.n} lands on the ${formatLength(lcSpanEnd, 'mm', 1)} mm mark: ${V.n} VSD = ${V.n - 1} MSD, so 1 VSD = ${formatLength(vsd(V), 'mm', 0.1)} mm and LC = 1 − ${formatLength(vsd(V), 'mm', 0.1)} = ${mm(leastCount(V), 0.1)}.`,
  ],
  'vernier-reading': () => [vernierFigure(23.47, 15, 43, 'Vernier reading example'), vernierCaption(23.47)],
  'vernier-pos-ze': () => [vernierFigure(0.3, -5, 17, 'Positive zero error'), vernierZeCaption(0.3)],
  'vernier-neg-ze': () => [vernierFigure(-0.3, -5, 17, 'Negative zero error'), vernierZeCaption(-0.3)],
  'screw-reading': () => [screwFigure(2.734, 'Screw gauge reading example'), screwCaption(2.734)],
  'screw-pos-ze': () => [screwFigure(0.04, 'Screw gauge positive zero error'), screwZeCaption(0.04)],
  'screw-neg-ze': () => [screwFigure(-0.04, 'Screw gauge negative zero error'), screwZeCaption(-0.04)],
};

for (const fig of document.querySelectorAll<HTMLElement>('figure[data-fig]')) {
  const make = figures[fig.dataset.fig ?? ''];
  if (!make) continue;
  const [art, caption] = make();
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  fig.append(art, cap);
}
