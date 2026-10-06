/**
 * Drawings of the screw-gauge objects (SPEC §6.6, §10.2). Each object rests
 * against the anvil face (x = 0); its drawn width along the axis is exactly
 * its true size at the current placement — or the gap, if the spindle is
 * squashing it (over-tightening), so the faces visibly touch.
 */
import type { MeasurableObject, Placement } from '../core/objects';
import { n4, svg } from './svgUtils';

export interface ScrewObjectSpec {
  obj: MeasurableObject;
  sizeMm: number;
  placement: Placement;
  gapMm: number;
  touching: boolean;
  compressionMm: number;
}

function contactShadow(x: number, y: number, h: number): SVGElement {
  return svg('ellipse', { cx: n4(x), cy: n4(y), rx: 0.18, ry: n4(h / 2), fill: 'url(#mat-contact)', opacity: 0.75 });
}

/** Copper wire lying across the gap; it runs above and below the spindle. */
function wire(spec: ScrewObjectSpec, w: number): SVGElement {
  const top = -17;
  const bottom = 12;
  // "Move along wire" shifts a small kink so the student can see the point changed.
  const kinkY = top + 3 + spec.placement.along * 8;
  const g = svg('g', { class: 'obj wire' }, [
    svg('path', {
      d: `M0 ${bottom}V${n4(kinkY + 1.2)}Q0 ${n4(kinkY)} -0.35 ${n4(kinkY - 1)}V${top}H${n4(w - 0.35)}V${n4(kinkY - 1)}Q${n4(w)} ${n4(kinkY)} ${n4(w)} ${n4(kinkY + 1.2)}V${bottom}Z`,
      fill: 'url(#mat-copper-h)',
      stroke: '#4a200a',
      'stroke-width': 0.04,
    }),
    // Fine specular line.
    svg('path', { d: `M${n4(w * 0.42)} ${bottom - 0.3}V${n4(kinkY + 1.4)}M${n4(w * 0.42 - 0.35)} ${n4(kinkY - 1.2)}V${top + 0.3}`, stroke: '#fff3e6', 'stroke-width': n4(Math.max(0.03, w * 0.07)), opacity: 0.8 }),
  ]);
  // Over-tightening: the soft wire flattens slightly at the faces (exaggerated so it can be seen).
  if (spec.compressionMm > 1e-6) {
    const bulge = Math.min(0.35, spec.compressionMm * 12);
    const h = 2 * 3 + spec.compressionMm * 120;
    g.append(
      svg('path', { d: `M0 ${n4(-h / 2)}q${n4(-bulge)} ${n4(h / 2)} 0 ${n4(h)}M${n4(w)} ${n4(-h / 2)}q${n4(bulge)} ${n4(h / 2)} 0 ${n4(h)}`, fill: '#b8642e', stroke: '#4a200a', 'stroke-width': 0.03 }),
    );
  }
  return g;
}

function coin(spec: ScrewObjectSpec, w: number): SVGElement {
  const h = 20;
  const y0 = -h / 2 - 2 + spec.placement.along * 4;
  const g = svg('g', { class: 'obj coin' }, [
    svg('rect', { x: 0, y: n4(y0), width: n4(w), height: h, rx: n4(Math.min(w / 2, 0.3)), fill: 'url(#mat-coin-edge)', stroke: '#4b535b', 'stroke-width': 0.05 }),
  ]);
  // Milled (reeded) edge.
  let reeds = '';
  for (let y = y0 + 0.4; y < y0 + h - 0.3; y += 0.45) reeds += `M0.05 ${n4(y)}H${n4(w - 0.05)}`;
  g.append(svg('path', { d: reeds, stroke: '#5c656e', 'stroke-width': 0.06, opacity: 0.6 }));
  return g;
}

function slide(spec: ScrewObjectSpec, w: number): SVGElement {
  const h = 24;
  const y0 = -15 + spec.placement.along * 4;
  return svg('g', { class: 'obj slide' }, [
    svg('rect', { x: 0, y: n4(y0), width: n4(w), height: h, fill: 'url(#mat-slide)', stroke: '#2f8579', 'stroke-width': 0.05 }),
    svg('path', { d: `M${n4(w * 0.35)} ${n4(y0 + 0.4)}V${n4(y0 + h - 0.4)}`, stroke: '#ffffff', 'stroke-width': 0.06, opacity: 0.8 }),
  ]);
}

function ball(spec: ScrewObjectSpec, w: number): SVGElement {
  const r = spec.sizeMm / 2;
  return svg('g', { class: 'obj ball' }, [
    svg('ellipse', { cx: n4(w / 2), cy: 0, rx: n4(w / 2), ry: n4(r), fill: 'url(#mat-ball)', stroke: '#2b3137', 'stroke-width': 0.05 }),
  ]);
}

function paper(spec: ScrewObjectSpec, w: number): SVGElement {
  const h = 20;
  const y0 = -13 + spec.placement.along * 3;
  const sheets = spec.obj.sheets ?? 50;
  let d = '';
  for (let i = 1; i < sheets; i++) {
    const x = (w * i) / sheets;
    d += `M${n4(x)} ${n4(y0 + 0.1)}V${n4(y0 + h - 0.1)}`;
  }
  return svg('g', { class: 'obj paper' }, [
    svg('rect', { x: 0, y: n4(y0), width: n4(w), height: h, fill: 'url(#mat-paper)', stroke: '#8f8a7c', 'stroke-width': 0.04 }),
    svg('path', { d, stroke: '#a49e8e', 'stroke-width': n4(Math.min(0.02, (w / sheets) * 0.3)), opacity: 0.8 }),
  ]);
}

/** A single hair: straight between the faces, gently curling beyond them. */
function hair(spec: ScrewObjectSpec, w: number): SVGElement {
  const c = w / 2;
  const sway = 0.6 + spec.placement.along * 0.8;
  return svg('g', { class: 'obj hair' }, [
    svg('path', {
      d: `M${n4(c + sway)} -18C${n4(c + sway * 1.6)} -13 ${n4(c - sway)} -9 ${n4(c)} -5V5C${n4(c + sway)} 8 ${n4(c - sway * 1.4)} 11 ${n4(c + sway * 0.5)} 15`,
      fill: 'none',
      // Mid-brown rather than near-black, so the strand still shows on the dark bench.
      stroke: '#7a5236',
      'stroke-width': n4(w),
      'stroke-linecap': 'round',
    }),
  ]);
}

/** Sewing needle: eye at the top, point at the bottom. */
function needle(spec: ScrewObjectSpec, w: number): SVGElement {
  const dy = spec.placement.along * 3 - 1.5;
  const top = -17 + dy;
  const tip = 13 + dy;
  return svg('g', { class: 'obj needle' }, [
    svg('path', {
      d: `M0 ${n4(tip - 4)}V${n4(top + 1)}Q0 ${n4(top)} ${n4(w / 2)} ${n4(top - 0.3)}Q${n4(w)} ${n4(top)} ${n4(w)} ${n4(top + 1)}V${n4(tip - 4)}L${n4(w / 2)} ${n4(tip)}Z`,
      fill: 'url(#mat-chrome-h)',
      stroke: '#3f474f',
      'stroke-width': 0.03,
    }),
    // The eye.
    svg('rect', { x: n4(w * 0.32), y: n4(top + 0.6), width: n4(w * 0.36), height: 1.6, rx: n4(w * 0.18), fill: '#20262c' }),
    svg('path', { d: `M${n4(w * 0.4)} ${n4(top + 2.6)}V${n4(tip - 4.5)}`, stroke: '#ffffff', 'stroke-width': n4(w * 0.08), opacity: 0.8 }),
  ]);
}

/** Mechanical-pencil lead: a graphite rod with snapped ends. */
function lead(spec: ScrewObjectSpec, w: number): SVGElement {
  const y0 = -15 + spec.placement.along * 3;
  const y1 = y0 + 26;
  return svg('g', { class: 'obj lead' }, [
    svg('path', {
      d: `M0 ${n4(y0 + 0.2)}L${n4(w * 0.4)} ${n4(y0)}L${n4(w)} ${n4(y0 + 0.3)}V${n4(y1 - 0.2)}L${n4(w * 0.55)} ${n4(y1)}L0 ${n4(y1 - 0.35)}Z`,
      fill: 'url(#mat-graphite)',
      stroke: '#0e1012',
      'stroke-width': 0.03,
    }),
    svg('path', { d: `M${n4(w * 0.5)} ${n4(y0 + 0.6)}V${n4(y1 - 0.6)}`, stroke: '#c9ced3', 'stroke-width': n4(w * 0.06), opacity: 0.6 }),
  ]);
}

/** Double-edge razor blade seen edge-on: bevelled to a cutting edge at both ends. */
function blade(spec: ScrewObjectSpec, w: number): SVGElement {
  const h = 20;
  const y0 = -12 + spec.placement.along * 4;
  return svg('g', { class: 'obj blade' }, [
    svg('path', {
      d: `M${n4(w / 2)} ${n4(y0 - 1.6)}L${n4(w)} ${n4(y0)}V${n4(y0 + h)}L${n4(w / 2)} ${n4(y0 + h + 1.6)}L0 ${n4(y0 + h)}V${n4(y0)}Z`,
      fill: 'url(#mat-chrome-h)',
      stroke: '#3f474f',
      'stroke-width': 0.015,
    }),
  ]);
}

/** Plastic ID card seen edge-on: a white PVC core under printed overlays. */
function card(spec: ScrewObjectSpec, w: number): SVGElement {
  const h = 24;
  const y0 = -14 + spec.placement.along * 4;
  const layer = n4(w * 0.07);
  return svg('g', { class: 'obj card' }, [
    svg('rect', { x: 0, y: n4(y0), width: n4(w), height: h, fill: 'url(#mat-card)', stroke: '#8a94a0', 'stroke-width': 0.03 }),
    svg('path', { d: `M${n4(w * 0.06)} ${n4(y0 + 0.1)}V${n4(y0 + h - 0.1)}`, stroke: '#2d5fa8', 'stroke-width': layer }),
    svg('path', { d: `M${n4(w * 0.94)} ${n4(y0 + 0.1)}V${n4(y0 + h - 0.1)}`, stroke: '#2d5fa8', 'stroke-width': layer }),
  ]);
}

export function drawScrewObject(back: SVGGElement, front: SVGGElement, spec: ScrewObjectSpec | null): void {
  back.replaceChildren();
  front.replaceChildren();
  if (!spec) return;
  // Squashed objects are drawn exactly as wide as the gap.
  const w = Math.min(spec.sizeMm, spec.gapMm);
  let el: SVGElement;
  switch (spec.obj.kind) {
    case 'wire':
      el = wire(spec, w);
      break;
    case 'sheet':
      el = coin(spec, w);
      break;
    case 'slide':
      el = slide(spec, w);
      break;
    case 'ball':
      el = ball(spec, w);
      break;
    case 'paper':
      el = paper(spec, w);
      break;
    case 'hair':
      el = hair(spec, w);
      break;
    case 'blade':
      el = blade(spec, w);
      break;
    case 'needle':
      el = needle(spec, w);
      break;
    case 'lead':
      el = lead(spec, w);
      break;
    case 'card':
      el = card(spec, w);
      break;
    default:
      return;
  }
  front.append(el);
  if (spec.touching) front.append(contactShadow(0.05, 0, 4), contactShadow(w - 0.05, 0, 4));
}
