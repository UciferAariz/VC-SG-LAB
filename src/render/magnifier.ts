/**
 * Circular loupe (SPEC §5.7). It re-uses the live scene with
 * <use href="#scene-id">, scaled about the focus point — no bitmap, no second
 * render — so it is exactly as crisp as the vector drawing itself.
 */
import { n4, setAttrs, svg } from './svgUtils';

export interface LoupeState {
  visible: boolean;
  /** Focus point in world mm. */
  focusX: number;
  focusY: number;
  /** Lens centre on screen (overlay px). */
  screenX: number;
  screenY: number;
  /** Screen px per mm of the main view. */
  viewScale: number;
  magnification: number;
  radius: number;
  pinned: boolean;
}

export interface Loupe {
  root: SVGGElement;
  /** Drag target (lens). */
  lens: SVGGElement;
  update(s: LoupeState): void;
}

export function createLoupe(sceneId: string): Loupe {
  const clipId = `${sceneId}-loupe-clip`;
  const clipCircle = svg('circle', { cx: 0, cy: 0, r: 100 });
  const bg = svg('circle', { cx: 0, cy: 0, r: 100, fill: 'var(--bench-2, #2b3138)' });
  const use = svg('use', { href: `#${sceneId}` });
  const content = svg('g', { 'clip-path': `url(#${clipId})` }, [bg, use]);
  const glare = svg('ellipse', { rx: 60, ry: 30, fill: 'url(#loupe-glare)', 'pointer-events': 'none' });
  const ring = svg('circle', { r: 100, fill: 'none', stroke: 'url(#loupe-ring)', 'stroke-width': 9 });
  const ringEdge = svg('circle', { r: 104.5, fill: 'none', stroke: '#1d2329', 'stroke-width': 1 });
  const label = svg('text', { class: 'loupe-label', 'text-anchor': 'middle' }, ['']);
  const pin = svg('g', { class: 'loupe-pin' }, [
    svg('circle', { r: 7, fill: '#e8590c', stroke: '#fff', 'stroke-width': 1.5 }),
  ]);
  const lens = svg('g', { class: 'loupe-lens', style: 'cursor: move' }, [content, glare, ring, ringEdge, label, pin]);
  const root = svg('g', { class: 'loupe' }, [
    svg('defs', {}, [
      svg('clipPath', { id: clipId }, [clipCircle]),
      svg('radialGradient', { id: 'loupe-glare', cx: 0.5, cy: 0.5, r: 0.5 }, [
        svg('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.16 }),
        svg('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }),
      ]),
      svg('linearGradient', { id: 'loupe-ring', x1: 0, y1: 0, x2: 1, y2: 1 }, [
        svg('stop', { offset: 0, 'stop-color': '#4d5560' }),
        svg('stop', { offset: 0.35, 'stop-color': '#c9cfd6' }),
        svg('stop', { offset: 0.6, 'stop-color': '#59616b' }),
        svg('stop', { offset: 1, 'stop-color': '#22282e' }),
      ]),
    ]),
    lens,
  ]);

  return {
    root,
    lens,
    update(s) {
      root.style.display = s.visible ? '' : 'none';
      if (!s.visible) return;
      const r = s.radius;
      const k = s.viewScale * s.magnification;
      lens.setAttribute('transform', `translate(${n4(s.screenX)} ${n4(s.screenY)})`);
      setAttrs(clipCircle, { r: n4(r) });
      setAttrs(bg, { r: n4(r) });
      setAttrs(ring, { r: n4(r) });
      setAttrs(ringEdge, { r: n4(r + 4.5) });
      setAttrs(glare, { cx: n4(-r * 0.35), cy: n4(-r * 0.5), rx: n4(r * 0.6), ry: n4(r * 0.3) });
      use.setAttribute('transform', `scale(${n4(k)}) translate(${n4(-s.focusX)} ${n4(-s.focusY)})`);
      setAttrs(label, { y: n4(r + 22) });
      label.textContent = `${s.magnification}×`;
      pin.setAttribute('transform', `translate(${n4(r * 0.72)} ${n4(-r * 0.72)})`);
      pin.style.display = s.pinned ? '' : 'none';
    },
  };
}
