/**
 * Canvas pan & zoom (SPEC §9.2): drag on empty bench to pan, two-finger
 * pinch to zoom and pan, Ctrl/⌘ + wheel to zoom at the cursor, plain wheel
 * (or trackpad scroll) to pan.
 */
import type { Viewport } from '../render/viewport';

export function attachPanZoom(el: SVGSVGElement, vp: Viewport): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;
  let pinchMid = { x: 0, y: 0 };

  const local = (e: PointerEvent) => vp.clientToLocal(e.clientX, e.clientY);

  const down = (e: PointerEvent) => {
    // Only start a pan on empty space; instrument parts stop propagation.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, local(e));
    el.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    el.classList.add('panning');
  };

  const move = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      vp.panBy(p.x - prev.x, p.y - prev.y);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinchDist > 0) vp.zoomAt(dist / pinchDist, mid.x, mid.y);
      vp.panBy(mid.x - pinchMid.x, mid.y - pinchMid.y);
      pinchDist = dist;
      pinchMid = mid;
    }
  };

  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinchDist = 0;
    if (pointers.size === 0) el.classList.remove('panning');
  };

  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = vp.clientToLocal(e.clientX, e.clientY);
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vp.height : 1;
    if (e.ctrlKey || e.metaKey) {
      vp.zoomAt(Math.exp((-e.deltaY * unit) / 300), p.x, p.y);
    } else if (e.shiftKey) {
      vp.panBy(-e.deltaY * unit, 0);
    } else {
      vp.panBy(-e.deltaX * unit, -e.deltaY * unit);
    }
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: false });
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('wheel', wheel);
  };
}
