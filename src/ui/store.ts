/**
 * A tiny reactive store. State is replaced immutably with `set`; subscribers
 * are batched into one call per animation frame so a fast drag produces at
 * most one render per frame.
 */

export type Listener<S> = (state: S, prev: S) => void;

export interface Store<S> {
  get(): S;
  set(patch: Partial<S> | ((s: S) => Partial<S>)): void;
  subscribe(fn: Listener<S>): () => void;
  /** Run listeners synchronously now (tests, first paint). */
  flush(): void;
}

export function createStore<S extends object>(initial: S, schedule: (cb: () => void) => void = defaultSchedule): Store<S> {
  let state = initial;
  let lastNotified = initial;
  let pending = false;
  const listeners = new Set<Listener<S>>();

  function flush(): void {
    pending = false;
    if (state === lastNotified) return;
    const prev = lastNotified;
    lastNotified = state;
    for (const fn of listeners) fn(state, prev);
  }

  return {
    get: () => state,
    set(patch) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      let changed = false;
      for (const k of Object.keys(p) as (keyof S)[]) {
        if (!Object.is(state[k], p[k])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...p };
      if (!pending) {
        pending = true;
        schedule(flush);
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    flush,
  };
}

function defaultSchedule(cb: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb);
  else queueMicrotask(cb);
}

/** True when any of the given keys changed between two states. */
export function changed<S>(a: S, b: S, ...keys: (keyof S)[]): boolean {
  return keys.some((k) => !Object.is(a[k], b[k]));
}
