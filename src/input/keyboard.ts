/**
 * Keyboard map for the vernier (SPEC §5.7): pure mapping from a key event
 * to an action, so it can be unit-tested without a DOM.
 */

export type VernierKeyAction =
  | { type: 'move'; mm: number }
  | { type: 'lock' }
  | { type: 'loupe' }
  | { type: 'zoom'; factor: number }
  | { type: 'fit' }
  | { type: 'focus' }
  | { type: 'reset' }
  | null;

export interface KeyLike {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export function vernierKeyAction(e: KeyLike): VernierKeyAction {
  if (e.ctrlKey || e.metaKey) return null;
  const step = e.altKey ? 0.001 : e.shiftKey ? 1 : 0.01;
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return { type: 'move', mm: step };
    case 'ArrowLeft':
    case 'ArrowDown':
      return { type: 'move', mm: -step };
    case 'PageUp':
      return { type: 'move', mm: 10 };
    case 'PageDown':
      return { type: 'move', mm: -10 };
    case 'l':
    case 'L':
      return { type: 'lock' };
    case 'm':
    case 'M':
      return { type: 'loupe' };
    case '+':
    case '=':
      return { type: 'zoom', factor: 1.25 };
    case '-':
    case '_':
      return { type: 'zoom', factor: 0.8 };
    case 'f':
    case 'F':
      return { type: 'fit' };
    case 's':
    case 'S':
      return { type: 'focus' };
    case '0':
      return { type: 'reset' };
    default:
      return null;
  }
}

/**
 * Keyboard map for the screw gauge (SPEC §6.7). Thimble turns are in
 * circular divisions (1 division = 360°/N); + opens, − closes.
 */
export type ScrewKeyAction =
  | { type: 'thimble'; divisions: number }
  | { type: 'turns'; turns: number }
  | { type: 'ratchet'; deg: number }
  | { type: 'open' }
  | { type: 'lock' }
  | { type: 'loupe' }
  | { type: 'zoom'; factor: number }
  | { type: 'fit' }
  | { type: 'focus' }
  | { type: 'reset' }
  | null;

/** Ratchet step per key press, degrees (one click = 18° of slip). */
export const RATCHET_KEY_DEG = 18;

export function screwKeyAction(e: KeyLike): ScrewKeyAction {
  if (e.ctrlKey || e.metaKey) return null;
  const step = e.shiftKey ? 0.1 : 1;
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return { type: 'thimble', divisions: step };
    case 'ArrowDown':
    case 'ArrowLeft':
      return { type: 'thimble', divisions: -step };
    case 'PageUp':
      return { type: 'turns', turns: 1 };
    case 'PageDown':
      return { type: 'turns', turns: -1 };
    case 'r':
      return { type: 'ratchet', deg: -RATCHET_KEY_DEG };
    case 'R':
      return { type: 'ratchet', deg: e.shiftKey ? RATCHET_KEY_DEG : -RATCHET_KEY_DEG };
    case 'o':
    case 'O':
      return { type: 'open' };
    case 'l':
    case 'L':
      return { type: 'lock' };
    case 'm':
    case 'M':
      return { type: 'loupe' };
    case '+':
    case '=':
      return { type: 'zoom', factor: 1.25 };
    case '-':
    case '_':
      return { type: 'zoom', factor: 0.8 };
    case 'f':
    case 'F':
      return { type: 'fit' };
    case 's':
    case 'S':
      return { type: 'focus' };
    case '0':
      return { type: 'reset' };
    default:
      return null;
  }
}
