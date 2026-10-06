/**
 * Pan/zoom camera for an SVG whose user unit is 1 mm.
 * The viewBox is computed from (centre, px-per-mm, element size), so the
 * drawing stays vector-crisp at every zoom (SPEC §10.3).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Viewport {
  /** World point at the centre of the view, mm. */
  cx = 0;
  cy = 0;
  /** Screen pixels per mm. */
  scale = 4;
  /** Pixel size of the SVG element. */
  width = 1;
  height = 1;
  /** Scale that fits the whole instrument (zoom 1×). */
  fitScale = 4;
  minZoom = 0.5;
  maxZoom = 12;
  private listeners = new Set<() => void>();

  constructor(private readonly el: SVGSVGElement) {}

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Current zoom relative to "fit instrument". */
  get zoom(): number {
    return this.scale / this.fitScale;
  }

  setSize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.apply();
  }

  apply(): void {
    const w = this.width / this.scale;
    const h = this.height / this.scale;
    this.el.setAttribute('viewBox', `${this.cx - w / 2} ${this.cy - h / 2} ${w} ${h}`);
    for (const fn of this.listeners) fn();
  }

  /** Scale needed to show `r` with `pad` px margin. */
  scaleFor(r: Rect, pad = 16): number {
    return Math.min((this.width - 2 * pad) / r.w, (this.height - 2 * pad) / r.h);
  }

  setFitRect(r: Rect): void {
    this.fitScale = Math.max(0.05, this.scaleFor(r));
  }

  show(r: Rect, pad = 16): void {
    this.scale = this.clampScale(this.scaleFor(r, pad));
    this.cx = r.x + r.w / 2;
    this.cy = r.y + r.h / 2;
    this.apply();
  }

  clampScale(s: number): number {
    return Math.min(this.fitScale * this.maxZoom, Math.max(this.fitScale * this.minZoom, s));
  }

  /** Zoom by `factor` keeping the world point under screen (sx, sy) fixed. */
  zoomAt(factor: number, sx = this.width / 2, sy = this.height / 2): void {
    const before = this.screenToWorld(sx, sy);
    this.scale = this.clampScale(this.scale * factor);
    const after = this.screenToWorld(sx, sy);
    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
    this.apply();
  }

  panBy(dxPx: number, dyPx: number): void {
    this.cx -= dxPx / this.scale;
    this.cy -= dyPx / this.scale;
    this.apply();
  }

  /** Screen px relative to the element's top-left → world mm. */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: this.cx + (sx - this.width / 2) / this.scale, y: this.cy + (sy - this.height / 2) / this.scale };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.cx) * this.scale + this.width / 2, y: (y - this.cy) * this.scale + this.height / 2 };
  }

  /** Client (page) coordinates → element-relative px. */
  clientToLocal(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const p = this.clientToLocal(clientX, clientY);
    return this.screenToWorld(p.x, p.y);
  }
}
