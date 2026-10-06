/**
 * Unified mouse / touch / pen dragging with Pointer Events and pointer
 * capture (SPEC §5.7). One active pointer per drag.
 */

export interface DragHandlers {
  /** Return false to refuse the drag (e.g. slider locked). */
  start(e: PointerEvent): boolean | void;
  move(e: PointerEvent): void;
  end?(e: PointerEvent): void;
}

export function onDrag(el: Element, handlers: DragHandlers): () => void {
  let active: number | null = null;

  const down = (ev: Event) => {
    const e = ev as PointerEvent;
    if (active !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (handlers.start(e) === false) return;
    active = e.pointerId;
    (el as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const move = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.pointerId !== active) return;
    e.preventDefault();
    handlers.move(e);
  };
  const up = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.pointerId !== active) return;
    active = null;
    handlers.end?.(e);
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
}
