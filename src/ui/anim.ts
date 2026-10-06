/** Tiny animation helpers that respect prefers-reduced-motion (SPEC §10.3). */

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Ease-in-out cubic. */
export function ease(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
}

/**
 * Call `frame(k)` with eased k from 0 to 1 over `ms`, once per animation
 * frame. With ms = 0 it jumps straight to the end.
 */
export function tween(ms: number, frame: (k: number) => void, done?: () => void): { cancel(): void } {
  let cancelled = false;
  if (ms <= 0) {
    frame(1);
    done?.();
    return { cancel: () => undefined };
  }
  const t0 = performance.now();
  const step = (now: number) => {
    if (cancelled) return;
    const k = Math.min(1, (now - t0) / ms);
    frame(ease(k));
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      done?.();
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, prefersReducedMotion() ? 0 : ms));
}
