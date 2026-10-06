/**
 * Physical layout of the drawn screw gauge, in mm (SVG user units).
 * x: along the spindle axis, 0 = anvil face. The spindle face is at x = s.
 * y: downward, 0 = the spindle axis = the datum line on the sleeve.
 *
 * The linear (pitch) scale's zero is at LINEAR_ZERO; the thimble's bevelled
 * edge sits at LINEAR_ZERO + p, where p = s + e (+ backlash slack) — SPEC §6.2.
 */
import { SCREW_RANGE_MM } from '../core/screw/config';

/** Anvil and spindle radius. */
export const SPINDLE_R = 3;
/** Inner face of the frame's left boss; the anvil sticks out from here to x = 0. */
export const FRAME_L_INNER = -7;
export const FRAME_L_OUTER = -21;
/** Inner face of the right boss. Must clear the full 25 mm opening. */
export const FRAME_R_INNER = 30;
export const FRAME_R_OUTER = 42;
/** Top of the two bosses. */
export const FRAME_TOP = -7.5;
/** Lowest point of the frame's outer curve. */
export const FRAME_BOTTOM = 44;

export const SLEEVE_R = 4.4;
export const SLEEVE_START = FRAME_R_OUTER - 0.5;
/** x of the linear-scale zero mark (thimble edge at p = 0). */
export const LINEAR_ZERO = 46;
/** The sleeve end stays hidden under the thimble for every p in range. */
export const SLEEVE_END = LINEAR_ZERO + SCREW_RANGE_MM + 3;

export const THIMBLE_R = 7.2;
export const THIMBLE_LEN = 30;
/** Width of the bevelled front edge of the thimble. */
export const BEVEL_W = 1.4;
/** Knurled grip band at the back of the thimble. */
export const GRIP_W = 9;

export const RATCHET_NECK = 2.2;
export const RATCHET_R = 4.6;
export const RATCHET_LEN = 11;

/** Lock lever pivot on top of the right boss. */
export const LOCK_X = 36;
export const LOCK_Y = FRAME_TOP;

/** Tick lengths on the sleeve (linear scale). */
export const LINEAR_TICK = { normal: 1.6, long: 2.4, half: 1.6 } as const;
/** Tick lengths on the thimble (circular scale), drawn from the bevel edge. */
export const CIRC_TICK = { minor: 1.5, mid: 2.1, major: 2.8 } as const;

/** World bounds of the whole instrument (for "fit instrument"). */
export function instrumentBounds(): { x: number; y: number; w: number; h: number } {
  const x = FRAME_L_OUTER - 4;
  const y = -22;
  const right = LINEAR_ZERO + SCREW_RANGE_MM + THIMBLE_LEN + RATCHET_NECK + RATCHET_LEN + 4;
  return { x, y, w: right - x, h: FRAME_BOTTOM + 6 - y };
}

/** Bounds around the datum line and thimble edge (for "focus on scale"). */
export function scaleFocusBounds(edgeX: number): { x: number; y: number; w: number; h: number } {
  return { x: edgeX - 11, y: -THIMBLE_R - 2, w: 20, h: 2 * THIMBLE_R + 4 };
}
