/**
 * Zero-error rules shared by both instruments (SPEC §4.3).
 *
 *   Zero error (ZE)   = reading with the jaws/faces closed on nothing
 *   Zero correction   = −ZE
 *   Corrected reading = Observed reading − ZE
 *
 * Everything is done in integer least counts so the subtraction is exact.
 */
import type { Rng } from './rng';
import { countsToMm } from './units';

export type ZeroErrorMode = 'none' | 'positive' | 'negative' | 'random' | 'custom';

export interface CustomZeroError {
  /** Magnitude of the zero error in divisions (|ZE| = divisions × LC). */
  divisions: number;
  sign: 1 | -1;
}

export interface ZeroErrorSettings {
  mode: ZeroErrorMode;
  custom?: CustomZeroError;
}

export type ZeroErrorKind = 'none' | 'positive' | 'negative';

export interface ZeroErrorInfo {
  kind: ZeroErrorKind;
  /** ZE in least counts (signed). */
  counts: number;
  /** ZE in mm (signed). */
  zeMm: number;
  /** Zero correction = −ZE, mm. */
  correctionMm: number;
  /**
   * The division that coincides (vernier) or lies on the datum line (screw)
   * when closed. For a positive ZE, ZE = +n × LC; for a negative ZE,
   * ZE = −(N − n) × LC.
   */
  n: number;
  /** Total divisions on the vernier / circular scale. */
  N: number;
  lcMm: number;
}

/**
 * Generate the instrument's TRUE zero offset e (mm) — continuous, not snapped.
 * Random magnitudes are a whole number of LCs in [1, maxDivisions] plus a
 * small sub-LC offset of ±0.15 LC, so the coincidence looks realistic but the
 * reading is unambiguous.
 */
export function generateZeroOffset(
  rng: Rng,
  settings: ZeroErrorSettings,
  lcMm: number,
  maxDivisions: number,
): number {
  const jitter = () => rng.range(-0.15, 0.15);
  const randomMagnitude = () => (rng.int(1, maxDivisions) + jitter()) * lcMm;
  switch (settings.mode) {
    case 'none':
      return 0;
    case 'positive':
      return randomMagnitude();
    case 'negative':
      return -randomMagnitude();
    case 'random':
      return rng.sign() * randomMagnitude();
    case 'custom': {
      const c = settings.custom ?? { divisions: 0, sign: 1 };
      if (c.divisions === 0) return 0;
      return c.sign * (Math.abs(c.divisions) + jitter()) * lcMm;
    }
  }
}

/** Describe a closed-jaw reading (in least counts) as an NCERT zero error. */
export function describeZeroError(closedCounts: number, N: number, lcMm: number): ZeroErrorInfo {
  const kind: ZeroErrorKind = closedCounts === 0 ? 'none' : closedCounts > 0 ? 'positive' : 'negative';
  // Positive: n = counts. Negative: counts = −(N − n) → n = N + counts (mod N for |ZE| ≥ 1 MSD).
  const n = kind === 'negative' ? (((closedCounts % N) + N) % N) : closedCounts % N;
  const zeMm = countsToMm(closedCounts, lcMm);
  return {
    kind,
    counts: closedCounts,
    zeMm,
    correctionMm: zeMm === 0 ? 0 : -zeMm,
    n,
    N,
    lcMm,
  };
}

/** Corrected reading = Observed − ZE, in least counts. */
export function correctedCounts(observedCounts: number, zeCounts: number): number {
  return observedCounts - zeCounts;
}

/** Corrected reading = Observed − ZE, in mm (exact via counts). */
export function correctedMm(observedCounts: number, zeCounts: number, lcMm: number): number {
  return countsToMm(correctedCounts(observedCounts, zeCounts), lcMm);
}
