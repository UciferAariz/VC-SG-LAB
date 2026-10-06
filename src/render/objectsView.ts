/**
 * Drawings of the measurable objects for the vernier (SPEC §5.6).
 * The drawn width along the measuring direction is EXACTLY the object's true
 * size at the current placement, so the jaws visibly touch it on contact.
 */
import type { MeasurableObject, Placement } from '../core/objects';
import { MAT } from './materials';
import { n4, svg } from './svgUtils';
import { BEAM_BOTTOM, BEAM_RIGHT, INNER_FACE_BOTTOM, ROD_Y } from './vernierLayout';

export interface VernierObjectSpec {
  obj: MeasurableObject;
  dimId: string;
  /** True size along the measured dimension, mm. */
  sizeMm: number;
  placement: Placement;
  gapMm: number;
  /** True when the jaw / rod is touching the object. */
  touching: boolean;
}

const TOP = BEAM_BOTTOM + 2.6;

function contactShadow(x: number, y: number, h: number): SVGElement {
  return svg('ellipse', { cx: n4(x), cy: n4(y), rx: 0.45, ry: n4(h / 2), fill: 'url(#mat-contact)', opacity: 0.8 });
}

function bob(spec: VernierObjectSpec): SVGElement {
  const d = spec.sizeMm;
  const nominal = spec.obj.dimensions[0]!.nominalMm;
  const rx = d / 2;
  const ry = Math.max(rx * 0.97, nominal - rx);
  const cx = rx;
  const cy = TOP + ry + 1;
  // Rotation cue: a meridian line whose width follows the orientation.
  const meridian = Math.abs(Math.cos((spec.placement.angleDeg * Math.PI) / 90)) * rx;
  return svg('g', { class: 'obj bob' }, [
    svg('rect', { x: n4(cx - 0.6), y: n4(cy - ry - 3.5), width: 1.2, height: 4, fill: MAT.brass, rx: 0.4 }),
    svg('circle', { cx: n4(cx), cy: n4(cy - ry - 4.4), r: 1.3, fill: 'none', stroke: '#8a6a22', 'stroke-width': 0.5 }),
    svg('ellipse', { cx: n4(cx), cy: n4(cy), rx: n4(rx), ry: n4(ry), fill: MAT.bob, stroke: '#4a3410', 'stroke-width': 0.12 }),
    svg('ellipse', { cx: n4(cx), cy: n4(cy), rx: n4(Math.max(0.2, meridian)), ry: n4(ry), fill: 'none', stroke: '#6b4a14', 'stroke-width': 0.1, opacity: 0.35 }),
    spec.touching ? contactShadow(0.2, cy, ry * 0.5) : null,
    spec.touching ? contactShadow(d - 0.2, cy, ry * 0.5) : null,
  ].filter(Boolean) as SVGElement[]);
}

function cylinder(spec: VernierObjectSpec): SVGElement {
  const dDim = spec.obj.dimensions.find((x) => x.id === 'diameter')!;
  const lDim = spec.obj.dimensions.find((x) => x.id === 'length')!;
  const g = svg('g', { class: 'obj cylinder' });
  if (spec.dimId === 'diameter') {
    // Axis vertical: width = d. The measuring point moves along the length.
    const d = spec.sizeMm;
    const L = lDim.nominalMm;
    const y0 = TOP - spec.placement.along * Math.max(0, L - 26);
    const cap = d * 0.14;
    g.append(
      svg('rect', { x: 0, y: n4(y0), width: n4(d), height: n4(L), fill: MAT.brassV }),
      svg('ellipse', { cx: n4(d / 2), cy: n4(y0 + L), rx: n4(d / 2), ry: n4(cap), fill: MAT.brassV }),
      svg('ellipse', { cx: n4(d / 2), cy: n4(y0), rx: n4(d / 2), ry: n4(cap), fill: '#f0d68a', stroke: '#8a6a22', 'stroke-width': 0.1 }),
      svg('path', { d: `M0 ${n4(y0)}V${n4(y0 + L)}M${n4(d)} ${n4(y0)}V${n4(y0 + L)}`, stroke: '#6d4a12', 'stroke-width': 0.1 }),
    );
    const cy = Math.min(Math.max(y0 + L / 2, 26), 44);
    if (spec.touching) g.append(contactShadow(0.2, cy, 8), contactShadow(d - 0.2, cy, 8));
  } else {
    // Axis horizontal: width = L, height = d.
    const L = spec.sizeMm;
    const d = dDim.nominalMm;
    const cap = d * 0.14;
    g.append(
      svg('rect', { x: 0, y: n4(TOP), width: n4(L), height: n4(d), fill: MAT.brass }),
      svg('ellipse', { cx: n4(L), cy: n4(TOP + d / 2), rx: n4(cap), ry: n4(d / 2), fill: '#e6c46a', stroke: '#8a6a22', 'stroke-width': 0.1 }),
      svg('path', { d: `M0 ${n4(TOP)}V${n4(TOP + d)}`, stroke: '#6d4a12', 'stroke-width': 0.12 }),
    );
    if (spec.touching) g.append(contactShadow(0.2, TOP + d / 2, d * 0.6), contactShadow(L - 0.2, TOP + d / 2, d * 0.6));
  }
  return g;
}

function block(spec: VernierObjectSpec): SVGElement {
  const dims = spec.obj.dimensions;
  const idx = dims.findIndex((x) => x.id === spec.dimId);
  const w = spec.sizeMm;
  const h = dims[(idx + 1) % dims.length]!.nominalMm;
  const g = svg('g', { class: 'obj block' }, [
    svg('rect', { x: 0, y: n4(TOP), width: n4(w), height: n4(h), fill: MAT.wood, stroke: '#5c3517', 'stroke-width': 0.12 }),
    svg('path', { d: `M0 ${n4(TOP + 0.6)}H${n4(w)}`, stroke: '#e3b07a', 'stroke-width': 0.3, opacity: 0.7 }),
  ]);
  // Wood grain, deterministic from the object's size.
  let grain = '';
  for (let i = 1; i < 7; i++) {
    const y = TOP + (h * i) / 7;
    grain += `M0.3 ${n4(y)}C${n4(w * 0.3)} ${n4(y - 0.8)} ${n4(w * 0.6)} ${n4(y + 0.9)} ${n4(w - 0.3)} ${n4(y - 0.2)}`;
  }
  g.append(svg('path', { d: grain, stroke: '#6f421d', 'stroke-width': 0.12, fill: 'none', opacity: 0.45 }));
  if (spec.touching) g.append(contactShadow(0.2, TOP + Math.min(h, 30) / 2, 8), contactShadow(w - 0.2, TOP + Math.min(h, 30) / 2, 8));
  return g;
}

/** Glass marble: a clear sphere with a coloured vane that turns with the marble. */
function marble(spec: VernierObjectSpec): SVGElement {
  const d = spec.sizeMm;
  const nominal = spec.obj.dimensions[0]!.nominalMm;
  const rx = d / 2;
  const ry = Math.max(rx * 0.97, nominal - rx);
  const cx = rx;
  const cy = TOP + ry + 1;
  const vane = `M${n4(-rx * 0.78)} 0C${n4(-rx * 0.3)} ${n4(-ry * 0.5)} ${n4(rx * 0.3)} ${n4(ry * 0.5)} ${n4(rx * 0.78)} 0C${n4(rx * 0.3)} ${n4(-ry * 0.18)} ${n4(-rx * 0.3)} ${n4(ry * 0.18)} ${n4(-rx * 0.78)} 0Z`;
  const turn = (deg: number) => `translate(${n4(cx)} ${n4(cy)}) rotate(${n4(spec.placement.angleDeg + deg)})`;
  const hx = cx - rx * 0.36;
  const hy = cy - ry * 0.42;
  return svg('g', { class: 'obj marble' }, [
    svg('ellipse', { cx: n4(cx), cy: n4(cy), rx: n4(rx), ry: n4(ry), fill: '#cdeef4', opacity: 0.5 }),
    svg('path', { d: vane, transform: turn(0), fill: '#e0552c', opacity: 0.85 }),
    svg('path', { d: vane, transform: turn(62), fill: '#f2b632', opacity: 0.75 }),
    svg('path', { d: vane, transform: turn(124), fill: '#2b7bd0', opacity: 0.7 }),
    svg('ellipse', { cx: n4(cx), cy: n4(cy), rx: n4(rx), ry: n4(ry), fill: MAT.marble, stroke: '#2f6f80', 'stroke-width': 0.12 }),
    svg('ellipse', { cx: n4(hx), cy: n4(hy), rx: n4(rx * 0.2), ry: n4(ry * 0.12), fill: '#ffffff', opacity: 0.85, transform: `rotate(-35 ${n4(hx)} ${n4(hy)})` }),
    spec.touching ? contactShadow(0.2, cy, ry * 0.5) : null,
    spec.touching ? contactShadow(d - 0.2, cy, ry * 0.5) : null,
  ].filter(Boolean) as SVGElement[]);
}

/** The AA cell's + button, mm (its height is part of the length). */
const NUB_H = 1.2;
const NUB_D = 5.5;

function battery(spec: VernierObjectSpec): SVGElement {
  const dDim = spec.obj.dimensions.find((x) => x.id === 'diameter')!;
  const lDim = spec.obj.dimensions.find((x) => x.id === 'length')!;
  const g = svg('g', { class: 'obj battery' });
  if (spec.dimId === 'diameter') {
    // Standing on its − end, + button up; the measuring point moves along the body.
    const d = spec.sizeMm;
    const L = lDim.nominalMm;
    const y0 = TOP - spec.placement.along * Math.max(0, L - 26);
    const yb = y0 + NUB_H;
    const ty = yb + L * 0.36;
    g.append(
      svg('rect', { x: n4(d / 2 - NUB_D / 2), y: n4(y0), width: NUB_D, height: NUB_H + 0.3, rx: 0.4, fill: MAT.aluminium, stroke: '#5d666f', 'stroke-width': 0.08 }),
      svg('rect', { x: 0, y: n4(yb), width: n4(d), height: n4(L - NUB_H), rx: 0.6, fill: MAT.cellV }),
      svg('rect', { x: 0, y: n4(yb), width: n4(d), height: 2.6, rx: 0.6, fill: MAT.aluminium }),
      svg('rect', { x: 0, y: n4(y0 + L - 1.4), width: n4(d), height: 1.4, rx: 0.5, fill: MAT.aluminium }),
      svg('rect', { x: 0, y: n4(yb + L * 0.55), width: n4(d), height: 2.2, fill: '#f4f1e6', opacity: 0.85 }),
      svg('text', { x: n4(d / 2), y: n4(yb + 7), 'font-size': 3.2, 'text-anchor': 'middle', class: 'ui-svg-text', fill: '#ffffff' }, ['+']),
      svg('text', { x: n4(d / 2), y: n4(ty), 'font-size': 2.6, 'text-anchor': 'middle', class: 'ui-svg-text', fill: '#e9f7ee', transform: `rotate(-90 ${n4(d / 2)} ${n4(ty)})` }, ['AA 1.5 V']),
      svg('path', { d: `M0 ${n4(yb + 0.6)}V${n4(y0 + L - 0.5)}M${n4(d)} ${n4(yb + 0.6)}V${n4(y0 + L - 0.5)}`, stroke: '#0a2615', 'stroke-width': 0.1 }),
    );
    const cy = Math.min(Math.max(y0 + L / 2, 26), 44);
    if (spec.touching) g.append(contactShadow(0.2, cy, 8), contactShadow(d - 0.2, cy, 8));
  } else {
    // Lying between the jaws: − end flat on the fixed jaw, + button on the moving jaw.
    const L = spec.sizeMm;
    const d = dDim.nominalMm;
    const cy = TOP + d / 2;
    const xb = L - NUB_H;
    g.append(
      svg('rect', { x: 0, y: n4(TOP), width: n4(xb), height: n4(d), rx: 0.6, fill: MAT.cellH }),
      svg('rect', { x: 0, y: n4(TOP), width: 1.4, height: n4(d), rx: 0.5, fill: MAT.chromeV }),
      svg('rect', { x: n4(xb - 2.6), y: n4(TOP), width: 2.6, height: n4(d), rx: 0.6, fill: MAT.chromeV }),
      svg('rect', { x: n4(xb - 0.3), y: n4(cy - NUB_D / 2), width: NUB_H + 0.3, height: NUB_D, rx: 0.4, fill: MAT.chromeV, stroke: '#5d666f', 'stroke-width': 0.08 }),
      svg('rect', { x: n4(L * 0.3), y: n4(TOP), width: 2.2, height: n4(d), fill: '#f4f1e6', opacity: 0.85 }),
      svg('text', { x: n4(L * 0.58), y: n4(cy + 1), 'font-size': 2.8, 'text-anchor': 'middle', class: 'ui-svg-text', fill: '#e9f7ee' }, ['AA 1.5 V']),
      svg('text', { x: n4(xb - 5), y: n4(cy + 1.1), 'font-size': 3.2, 'text-anchor': 'middle', class: 'ui-svg-text', fill: '#ffffff' }, ['+']),
    );
    if (spec.touching) g.append(contactShadow(0.2, cy, d * 0.6), contactShadow(L - 0.2, cy, NUB_D * 0.6));
  }
  return g;
}

/** Hollow brass tube between the outer jaws: the bore shows at the visible end. */
function tubeOuter(spec: VernierObjectSpec): SVGElement {
  const Dn = spec.obj.dimensions.find((x) => x.id === 'externalDiameter')!.nominalMm;
  const dn = spec.obj.dimensions.find((x) => x.id === 'internalDiameter')!.nominalMm;
  const Ln = spec.obj.dimensions.find((x) => x.id === 'length')!.nominalMm;
  const g = svg('g', { class: 'obj tube' });
  if (spec.dimId === 'externalDiameter') {
    const D = spec.sizeMm;
    const y0 = TOP - spec.placement.along * Math.max(0, Ln - 26);
    const cap = D * 0.14;
    g.append(
      svg('rect', { x: 0, y: n4(y0), width: n4(D), height: n4(Ln), fill: MAT.brassV }),
      svg('ellipse', { cx: n4(D / 2), cy: n4(y0 + Ln), rx: n4(D / 2), ry: n4(cap), fill: MAT.brassV }),
      svg('ellipse', { cx: n4(D / 2), cy: n4(y0), rx: n4(D / 2), ry: n4(cap), fill: '#f0d68a', stroke: '#8a6a22', 'stroke-width': 0.1 }),
      svg('ellipse', { cx: n4(D / 2), cy: n4(y0), rx: n4(dn / 2), ry: n4((cap * dn) / Dn), fill: '#3b2a0c', stroke: '#8a6a22', 'stroke-width': 0.08 }),
      svg('path', { d: `M0 ${n4(y0)}V${n4(y0 + Ln)}M${n4(D)} ${n4(y0)}V${n4(y0 + Ln)}`, stroke: '#6d4a12', 'stroke-width': 0.1 }),
    );
    const cy = Math.min(Math.max(y0 + Ln / 2, 26), 44);
    if (spec.touching) g.append(contactShadow(0.2, cy, 8), contactShadow(D - 0.2, cy, 8));
  } else {
    const L = spec.sizeMm;
    const cap = Dn * 0.14;
    const cy = TOP + Dn / 2;
    g.append(
      svg('rect', { x: 0, y: n4(TOP), width: n4(L), height: n4(Dn), fill: MAT.brass }),
      svg('ellipse', { cx: n4(L), cy: n4(cy), rx: n4(cap), ry: n4(Dn / 2), fill: '#e6c46a', stroke: '#8a6a22', 'stroke-width': 0.1 }),
      svg('ellipse', { cx: n4(L), cy: n4(cy), rx: n4((cap * dn) / Dn), ry: n4(dn / 2), fill: '#3b2a0c', stroke: '#8a6a22', 'stroke-width': 0.08 }),
      svg('path', { d: `M0 ${n4(TOP)}V${n4(TOP + Dn)}`, stroke: '#6d4a12', 'stroke-width': 0.12 }),
    );
    if (spec.touching) g.append(contactShadow(0.2, cy, Dn * 0.6), contactShadow(L - 0.2, cy, Dn * 0.6));
  }
  return g;
}

/** Hollow tube (in section) over the inner jaws: bore walls at x = 0 and x = d. */
function tubeInner(spec: VernierObjectSpec, back: SVGGElement): SVGElement {
  const d = spec.sizeMm;
  const Dn = spec.obj.dimensions.find((x) => x.id === 'externalDiameter')!.nominalMm;
  const dn = spec.obj.dimensions.find((x) => x.id === 'internalDiameter')!.nominalMm;
  const wall = (Dn - dn) / 2;
  const mouth = INNER_FACE_BOTTOM + 0.2;
  const shown = 38;
  const top = mouth - shown;
  back.append(svg('rect', { x: 0, y: n4(top), width: n4(d), height: shown, fill: '#3b2a0c', opacity: 0.25 }));
  const brassWall = (x: number) =>
    svg('g', {}, [
      svg('rect', { x: n4(x), y: n4(top), width: n4(wall), height: shown, fill: MAT.brassV, stroke: '#6d4a12', 'stroke-width': 0.14 }),
      svg('rect', { x: n4(x), y: n4(top), width: n4(wall), height: shown, fill: 'url(#mat-section)', opacity: 0.4 }),
    ]);
  const g = svg('g', { class: 'obj tube' }, [
    brassWall(-wall),
    brassWall(d),
    // Break line: the rest of the (longer) tube is not drawn.
    svg('path', { d: `M${n4(-wall - 1)} ${n4(top)}l1.5 -1.2l1.5 1.2l1.5 -1.2`, stroke: '#8a6a22', fill: 'none', 'stroke-width': 0.14 }),
    svg('path', { d: `M${n4(d - 1)} ${n4(top)}l1.5 -1.2l1.5 1.2l1.5 -1.2`, stroke: '#8a6a22', fill: 'none', 'stroke-width': 0.14 }),
    svg('text', { x: n4(d / 2), y: n4(top + 6), 'font-size': 2.6, 'text-anchor': 'middle', class: 'ui-svg-text', fill: '#f0d68a' }, ['tube (cut-away)']),
  ]);
  if (spec.touching) g.append(contactShadow(0.15, -20, 5), contactShadow(d - 0.15, -20, 5));
  return g;
}

/**
 * Matchbox. The face shown depends on the dimension measured:
 * l → label face (l × b), b → open end (b × h), h → striking side (h × l).
 */
function matchbox(spec: VernierObjectSpec): SVGElement {
  const dims = spec.obj.dimensions;
  const idx = dims.findIndex((x) => x.id === spec.dimId);
  const w = spec.sizeMm;
  const h = dims[(idx + 1) % dims.length]!.nominalMm;
  const g = svg('g', { class: 'obj matchbox' }, [
    svg('rect', { x: 0, y: n4(TOP), width: n4(w), height: n4(h), rx: 0.3, fill: MAT.cardboard, stroke: '#7a5520', 'stroke-width': 0.12 }),
  ]);
  if (spec.dimId === 'length') {
    const r = Math.min(w, h) * 0.2;
    const cx = w / 2;
    const cy = TOP + h * 0.42;
    g.append(
      svg('rect', { x: 1.2, y: n4(TOP + 1.2), width: n4(w - 2.4), height: n4(h - 2.4), fill: 'none', stroke: '#c2341f', 'stroke-width': 0.8 }),
      svg('circle', { cx: n4(cx), cy: n4(cy), r: n4(r), fill: '#c2341f' }),
      svg('path', {
        d: `M${n4(cx)} ${n4(cy - r * 0.7)}C${n4(cx + r * 0.55)} ${n4(cy - r * 0.1)} ${n4(cx + r * 0.4)} ${n4(cy + r * 0.6)} ${n4(cx)} ${n4(cy + r * 0.6)}C${n4(cx - r * 0.4)} ${n4(cy + r * 0.6)} ${n4(cx - r * 0.55)} ${n4(cy - r * 0.1)} ${n4(cx)} ${n4(cy - r * 0.7)}Z`,
        fill: '#f6c445',
      }),
      svg('text', { x: n4(cx), y: n4(TOP + h - 3.2), 'font-size': n4(Math.min(2.4, w / 10)), 'text-anchor': 'middle', class: 'ui-svg-text', fill: '#7a1e10' }, ['SAFETY MATCHES']),
    );
  } else if (spec.dimId === 'breadth') {
    // Open end: the tray inside the sleeve, full of match heads.
    let heads = '';
    for (let x = 2.4; x < w - 1.8; x += 2.3) heads += `M${n4(x)} ${n4(TOP + h * 0.5)}h0.01`;
    g.append(
      svg('rect', { x: 0.6, y: n4(TOP + 0.6), width: n4(w - 1.2), height: n4(h - 1.2), fill: '#c9a46a', stroke: '#8a6a3a', 'stroke-width': 0.1 }),
      svg('rect', { x: 1.2, y: n4(TOP + 1.2), width: n4(w - 2.4), height: n4(h - 2.4), fill: '#5a3f22' }),
      svg('path', { d: heads, stroke: '#a3261a', 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
    );
  } else {
    // Striking side: a brown abrasive strip.
    const sw = Math.max(0.5, w - 2.4);
    const sh = Math.max(1, h - 6);
    g.append(
      svg('rect', { x: 1.2, y: n4(TOP + 3), width: n4(sw), height: n4(sh), rx: 0.3, fill: '#5d3a26' }),
      svg('rect', { x: 1.2, y: n4(TOP + 3), width: n4(sw), height: n4(sh), rx: 0.3, fill: MAT.knurl, opacity: 0.12 }),
    );
  }
  if (spec.touching) g.append(contactShadow(0.2, TOP + Math.min(h, 30) / 2, 8), contactShadow(w - 0.2, TOP + Math.min(h, 30) / 2, 8));
  return g;
}

const WALL = 1.6;

function glassWall(x: number, y: number, w: number, h: number): SVGElement {
  return svg('g', {}, [
    svg('rect', { x: n4(x), y: n4(y), width: n4(w), height: n4(h), fill: '#bfe3de', 'fill-opacity': 0.85, stroke: '#3f8f86', 'stroke-width': 0.16 }),
    // Hatching marks the cut (section) faces.
    svg('rect', { x: n4(x), y: n4(y), width: n4(w), height: n4(h), fill: 'url(#mat-section)', opacity: 0.6 }),
  ]);
}

/** Beaker (inverted, in section) for the inner jaws: inner walls at x = 0 and x = D. */
function beakerInner(spec: VernierObjectSpec, back: SVGGElement): SVGElement {
  const D = spec.sizeMm;
  const mouth = INNER_FACE_BOTTOM + 0.2;
  const shown = 38;
  const top = mouth - shown;
  back.append(svg('rect', { x: 0, y: n4(top), width: n4(D), height: shown, fill: '#d8f0ec', opacity: 0.12 }));
  const g = svg('g', { class: 'obj beaker' }, [
    glassWall(-WALL, top, WALL, shown),
    glassWall(D, top, WALL, shown),
    // Rounded rim lips at the mouth.
    svg('rect', { x: -WALL - 0.5, y: n4(mouth - 1.2), width: WALL + 0.5, height: 1.2, rx: 0.5, fill: '#bfe3de', stroke: '#3f8f86', 'stroke-width': 0.14 }),
    svg('rect', { x: n4(D), y: n4(mouth - 1.2), width: WALL + 0.5, height: 1.2, rx: 0.5, fill: '#bfe3de', stroke: '#3f8f86', 'stroke-width': 0.14 }),
    // Break line: the rest of the (taller) beaker is not drawn.
    svg('path', { d: `M${-WALL - 1} ${n4(top)}l1.5 -1.2l1.5 1.2l1.5 -1.2`, stroke: '#5fa8a0', fill: 'none', 'stroke-width': 0.14 }),
    svg('path', { d: `M${n4(D - 1)} ${n4(top)}l1.5 -1.2l1.5 1.2l1.5 -1.2`, stroke: '#5fa8a0', fill: 'none', 'stroke-width': 0.14 }),
    svg('text', { x: n4(D / 2), y: n4(top + 6), 'font-size': 3, 'text-anchor': 'middle', class: 'ui-svg-text', fill: '#cfe9e5' }, ['beaker (cut-away, upside down)']),
  ]);
  if (spec.touching) g.append(contactShadow(0.15, -20, 5), contactShadow(D - 0.15, -20, 5));
  return g;
}

/** Beaker lying on its side (section) for the depth rod: rim at the beam end. */
function beakerDepth(spec: VernierObjectSpec, back: SVGGElement): SVGElement {
  const depth = spec.sizeMm;
  const D = spec.obj.dimensions.find((x) => x.id === 'internalDiameter')!.nominalMm;
  const x0 = BEAM_RIGHT;
  const yIn = ROD_Y - 5;
  back.append(svg('rect', { x: x0, y: n4(yIn), width: n4(depth), height: n4(D), fill: '#d8f0ec', opacity: 0.12 }));
  const g = svg('g', { class: 'obj beaker' }, [
    glassWall(x0, yIn - WALL, depth, WALL),
    glassWall(x0, yIn + D, depth, WALL),
    glassWall(x0 + depth, yIn - WALL, WALL * 1.4, D + 2 * WALL),
    svg('text', { x: n4(x0 + depth / 2), y: n4(yIn + D - 3), 'font-size': 3, 'text-anchor': 'middle', class: 'ui-svg-text', fill: '#cfe9e5' }, ['beaker (cut-away)']),
  ]);
  if (spec.touching) g.append(contactShadow(x0 + depth, ROD_Y, 2.5));
  return g;
}

/** Redraw the current object (or nothing) into the two layers. */
export function drawVernierObject(back: SVGGElement, front: SVGGElement, spec: VernierObjectSpec | null): void {
  back.replaceChildren();
  front.replaceChildren();
  if (!spec) return;
  switch (spec.obj.kind) {
    case 'bob':
      front.append(bob(spec));
      break;
    case 'cylinder':
      front.append(cylinder(spec));
      break;
    case 'block':
      front.append(block(spec));
      break;
    case 'beaker':
      front.append(spec.dimId === 'depth' ? beakerDepth(spec, back) : beakerInner(spec, back));
      break;
    case 'marble':
      front.append(marble(spec));
      break;
    case 'battery':
      front.append(battery(spec));
      break;
    case 'tube':
      front.append(spec.dimId === 'internalDiameter' ? tubeInner(spec, back) : tubeOuter(spec));
      break;
    case 'matchbox':
      front.append(matchbox(spec));
      break;
    default:
      break;
  }
}

/** Extra world bounds an object needs (so "fit" includes it). */
export function objectExtent(spec: VernierObjectSpec | null): { maxX: number; minY: number; maxY: number } {
  if (!spec) return { maxX: 0, minY: 0, maxY: 0 };
  if (spec.obj.kind === 'beaker' && spec.dimId === 'depth') {
    const D = spec.obj.dimensions.find((x) => x.id === 'internalDiameter')!.nominalMm;
    return { maxX: BEAM_RIGHT + spec.sizeMm + 4, minY: 0, maxY: ROD_Y - 5 + D + 4 };
  }
  if (spec.obj.kind === 'beaker' || (spec.obj.kind === 'tube' && spec.dimId === 'internalDiameter')) {
    return { maxX: spec.sizeMm + 4, minY: INNER_FACE_BOTTOM - 42, maxY: 0 };
  }
  return { maxX: 0, minY: 0, maxY: TOP + 70 };
}
