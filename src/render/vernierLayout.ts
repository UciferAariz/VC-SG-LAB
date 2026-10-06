/**
 * Physical layout of the drawn vernier callipers, in mm (SVG user units).
 * x: along the beam, 0 = main-scale zero = fixed outer-jaw measuring face.
 * y: downward. The main scale and vernier scale meet at y = SCALE_EDGE.
 */
import { MAIN_SCALE_RANGE_MM, maxGapMm, vernierSpanMm, VERNIER_PRESETS, type VernierConfig } from '../core/vernier/config';

export const BEAM_TOP = 0;
export const BEAM_BOTTOM = 18;
/** The shared edge where main-scale ticks (above) meet vernier ticks (below). */
export const SCALE_EDGE = 12;
/** The beam continues a little left of zero so a negative-ZE vernier zero is visible (SPEC §5.4). */
export const BEAM_LEFT = -20;
/** Raised fixed head / slider lip above the beam. */
export const LIP_TOP = -3.2;
/** Outer (lower) jaw tip. */
export const OUTER_JAW_TIP = 58.5;
/** Inner (upper) jaw knife-edge faces span this y-range. */
export const INNER_FACE_TOP = -23;
export const INNER_FACE_BOTTOM = -17;
/** Half-width of the inner jaw tips (they cross over, see DECISIONS D27). */
export const INNER_TIP_W = 1.4;
/** Depth rod centre line. */
export const ROD_Y = 9;
export const ROD_H = 1.5;
/** How far the vernier bevel strip extends left of the moving jaw face. */
export const BEVEL_LEFT = 1.6;

/** Length of the slider for a config: long enough for the vernier scale plus grip. */
export function sliderLength(c: VernierConfig): number {
  return Math.max(40, vernierSpanMm(c) + 14);
}

/** Beam right end: every preset's slider must stay on the beam at full opening. */
export const BEAM_RIGHT = Math.ceil(
  Math.max(...Object.values(VERNIER_PRESETS).map((c) => maxGapMm(c) + sliderLength(c))) + 6,
);

export const MAIN_SCALE_END = MAIN_SCALE_RANGE_MM;

/** World bounds of the whole instrument (for "fit instrument"). */
export function instrumentBounds(): { x: number; y: number; w: number; h: number } {
  const x = BEAM_LEFT - 4;
  const y = INNER_FACE_TOP - 10;
  return { x, y, w: BEAM_RIGHT + 30 - x, h: OUTER_JAW_TIP + 8 - y };
}

/** Bounds around the scales near the vernier (for "focus on scale"). */
export function scaleFocusBounds(xMm: number, c: VernierConfig): { x: number; y: number; w: number; h: number } {
  const span = vernierSpanMm(c);
  const w = Math.max(40, span + 16);
  return { x: xMm + span / 2 - w / 2, y: 1, w, h: 22 };
}
