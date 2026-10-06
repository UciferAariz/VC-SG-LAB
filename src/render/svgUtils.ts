/** Small helpers for building SVG programmatically. */

export const SVG_NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number | null | undefined | false>;

/** Create an SVG element with attributes and optional children. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (SVGElement | string | null | undefined | false)[] = [],
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function setAttrs(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) el.removeAttribute(k);
    else el.setAttribute(k, String(v));
  }
}

/** Round to 4 decimals for compact, stable path data (0.1 µm at mm scale). */
export function n4(v: number): string {
  return String(Math.round(v * 1e4) / 1e4);
}

/** Path data for a closed polygon. */
export function polygonPath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${n4(x)} ${n4(y)}`).join('') + 'Z';
}

/** Rounded-corner polygon: each corner gets a quadratic fillet of radius r (clamped). */
export function roundedPath(points: [number, number][], r: number): string {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]];
    const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(v1[0]!, v1[1]!);
    const l2 = Math.hypot(v2[0]!, v2[1]!);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [p1[0] + (v1[0]! / l1) * rr, p1[1] + (v1[1]! / l1) * rr];
    const b = [p1[0] + (v2[0]! / l2) * rr, p1[1] + (v2[1]! / l2) * rr];
    d += `${i === 0 ? 'M' : 'L'}${n4(a[0]!)} ${n4(a[1]!)}Q${n4(p1[0])} ${n4(p1[1])} ${n4(b[0]!)} ${n4(b[1]!)}`;
  }
  return d + 'Z';
}

export function translate(x: number, y = 0): string {
  return `translate(${n4(x)} ${n4(y)})`;
}

let uid = 0;
/** Unique id for defs that may appear more than once per document. */
export function uniqueId(prefix: string): string {
  uid += 1;
  return `${prefix}-${uid}`;
}
