/**
 * Vernier geometry (SPEC §5.2). Pure positions in mm along the beam.
 *
 * x = position of the vernier ZERO mark relative to the main-scale zero mark.
 *   x = gap + e      (e = zero-error offset of the instrument)
 * Main mark m (integer ≥ 0) is at m × MSD.
 * Vernier mark k (0 … N) is at x + k × VSD.
 */
import { EPS } from '../units';
import { MAIN_SCALE_RANGE_MM, maxGapMm, vernierLabelEvery, vsd, type VernierConfig } from './config';

export type TickSize = 'short' | 'medium' | 'long';

export interface Tick {
  index: number;
  /** Position along the beam, mm from the main-scale zero mark. */
  posMm: number;
  size: TickSize;
  label: string | null;
}

/** Vernier zero position for a given jaw gap and zero-error offset. */
export function vernierZeroPosition(gapMm: number, zeroOffsetMm: number): number {
  return gapMm + zeroOffsetMm;
}

/**
 * Main scale ticks from 0 to `rangeMm`. 1 mm short, 5 mm medium, 10 mm long,
 * labelled in cm every 10 mm (0, 1, 2 … 15). There are NO marks left of 0.
 */
export function mainTicks(rangeMm: number = MAIN_SCALE_RANGE_MM, msd = 1): Tick[] {
  const ticks: Tick[] = [];
  const count = Math.floor(rangeMm / msd + EPS);
  const per5 = Math.round(5 / msd);
  const per10 = Math.round(10 / msd);
  for (let m = 0; m <= count; m++) {
    const long = m % per10 === 0;
    ticks.push({
      index: m,
      posMm: m * msd,
      size: long ? 'long' : m % per5 === 0 ? 'medium' : 'short',
      label: long ? String(m / per10) : null,
    });
  }
  return ticks;
}

/**
 * Vernier ticks for the vernier zero at x. Labels run 0 … 10 whatever N is;
 * the 0, middle and end marks are long, labelled marks medium, others short.
 */
export function vernierTicks(x: number, c: VernierConfig): Tick[] {
  const every = vernierLabelEvery(c);
  const half = c.n / 2;
  const d = vsd(c);
  const ticks: Tick[] = [];
  for (let k = 0; k <= c.n; k++) {
    const labelled = k % every === 0;
    ticks.push({
      index: k,
      posMm: x + k * d,
      size: k % half === 0 ? 'long' : labelled ? 'medium' : 'short',
      label: labelled ? String(k / every) : null,
    });
  }
  return ticks;
}

/**
 * Index of the main-scale mark nearest to `posMm`. The main scale has no
 * marks left of zero, so positions left of 0 are compared against mark 0.
 */
export function nearestMainMark(posMm: number, msd: number): number {
  return Math.max(0, Math.round(posMm / msd));
}

/**
 * Signed distance (mm) from vernier mark k to its nearest main-scale mark.
 * Positive means the vernier mark lies to the RIGHT of that main mark.
 */
export function coincidenceMisalignment(x: number, k: number, c: VernierConfig): number {
  const pos = x + k * vsd(c);
  return pos - nearestMainMark(pos, c.msd) * c.msd;
}

/** How a jaw / rod meets the object being measured. */
export type VernierContact = 'outer' | 'inner' | 'depth';

/**
 * Collision clamp (SPEC §5.6). Outer jaws close onto an object and cannot go
 * below its size; inner jaws open inside a hollow and cannot exceed its
 * internal diameter; the depth rod cannot go deeper than the base.
 * With no object (`sizeMm` null) the jaws can close fully.
 */
export function clampGap(
  requestedMm: number,
  c: VernierConfig,
  contact: VernierContact | null,
  sizeMm: number | null,
): number {
  let g = Math.min(Math.max(requestedMm, 0), maxGapMm(c));
  if (contact !== null && sizeMm !== null) {
    g = contact === 'outer' ? Math.max(g, sizeMm) : Math.min(g, sizeMm);
  }
  return g;
}
