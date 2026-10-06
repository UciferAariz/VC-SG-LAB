/**
 * Landing page: theme from the saved preferences and the two small card
 * illustrations (decorative). The illustration ticks are generated from the
 * same core geometry as the instruments.
 */
import '../styles/main.css';
import { mainTicks, vernierTicks } from '../core/vernier/geometry';
import { VERNIER_PRESETS } from '../core/vernier/config';
import { circularMarks, linearMarks } from '../core/screw/geometry';
import { SCREW_PRESETS } from '../core/screw/config';
import { n4, svg } from '../render/svgUtils';
import { applyTheme, loadPrefs } from '../ui/prefs';

applyTheme(loadPrefs().theme);

function vernierArt(): SVGSVGElement {
  const c = VERNIER_PRESETS.standard;
  const root = svg('svg', { viewBox: '-14 -16 96 58', class: 'art' });
  const steel = '#c3c9cf';
  let main = '';
  for (const tk of mainTicks(70, 1)) main += `M${tk.posMm} 8V${8 - (tk.size === 'long' ? 3.4 : tk.size === 'medium' ? 2.4 : 1.6)}`;
  const x = 23.47;
  let vern = '';
  for (const tk of vernierTicks(x, c)) vern += `M${n4(tk.posMm)} 8V${8 + (tk.size === 'long' ? 2.8 : 2)}`;
  root.append(
    svg('rect', { x: -12, y: 0, width: 92, height: 12, rx: 1, fill: steel, stroke: '#59626c', 'stroke-width': 0.3 }),
    svg('path', { d: 'M-12 12H0V34L-0.6 38L-6 34L-12 20Z', fill: '#aeb5bc', stroke: '#59626c', 'stroke-width': 0.3 }),
    svg('path', { d: `M${x} 8H${x + 22}V20H${x + 12}L${x + 6} 26L${x + 0.6} 38L${x} 34V12H${x - 1}Z`, fill: '#dde1e5', stroke: '#59626c', 'stroke-width': 0.3 }),
    svg('path', { d: 'M-4 0L0 -12V0Z', fill: '#aeb5bc', stroke: '#59626c', 'stroke-width': 0.3 }),
    svg('path', { d: `M${x + 4} 0L${x} -12V0Z`, fill: '#aeb5bc', stroke: '#59626c', 'stroke-width': 0.3 }),
    svg('path', { d: main, stroke: '#1a1a1a', 'stroke-width': 0.2 }),
    svg('path', { d: vern, stroke: '#1a1a1a', 'stroke-width': 0.2 }),
  );
  return root;
}

function screwArt(): SVGSVGElement {
  const c = SCREW_PRESETS.standard;
  const p = 2.73;
  const root = svg('svg', { viewBox: '-16 -14 80 46', class: 'art' });
  const edge = 26 + p * 2;
  let lin = '';
  for (const m of linearMarks(c, 25)) {
    const xm = 26 + m.posMm * 2;
    if (xm > edge) continue;
    lin += m.side === 'upper' ? `M${n4(xm)} 0V-1.6` : `M${n4(xm)} 0V1.6`;
  }
  let circ = '';
  for (const m of circularMarks(p, c)) {
    const y = 6.5 * m.yOverR;
    circ += `M${n4(edge)} ${n4(y)}h${m.size === 'major' ? 2.2 : 1.3}`;
  }
  root.append(
    svg('path', { d: 'M-14 -5H-6V2C-6 22 20 22 20 2V-5H26V4C26 30 -14 30 -14 4Z', fill: '#2b4687', stroke: '#0d1838', 'stroke-width': 0.4 }),
    svg('rect', { x: -6, y: -2.2, width: 6, height: 4.4, fill: '#dfe3e7' }),
    svg('rect', { x: 2, y: -2.2, width: 24, height: 4.4, fill: '#dfe3e7' }),
    svg('rect', { x: 25, y: -3.4, width: edge - 25, height: 6.8, fill: '#e8ebee', stroke: '#59626c', 'stroke-width': 0.3 }),
    svg('path', { d: `M25.5 0H${edge}`, stroke: '#1a1a1a', 'stroke-width': 0.25 }),
    svg('path', { d: lin, stroke: '#1a1a1a', 'stroke-width': 0.25 }),
    svg('rect', { x: edge, y: -6.5, width: 22, height: 13, fill: '#d2d7dc', stroke: '#4a535c', 'stroke-width': 0.3 }),
    svg('path', { d: circ, stroke: '#1a1a1a', 'stroke-width': 0.25 }),
    svg('rect', { x: edge + 23, y: -4, width: 8, height: 8, rx: 0.8, fill: '#b9c0c6', stroke: '#4a535c', 'stroke-width': 0.3 }),
  );
  return root;
}

for (const el of document.querySelectorAll<HTMLElement>('[data-art]')) {
  el.append(el.dataset.art === 'screw' ? screwArt() : vernierArt());
}
