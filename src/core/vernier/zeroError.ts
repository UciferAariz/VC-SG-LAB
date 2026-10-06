/**
 * Vernier zero error (SPEC §5.4).
 *
 * With the jaws closed (gap = 0) the vernier zero sits at x = e.
 *  - Positive ZE: vernier zero RIGHT of main zero. Division n coincides → ZE = +n × LC.
 *  - Negative ZE: vernier zero LEFT of main zero.  Division n coincides → ZE = −(N − n) × LC.
 * The general reading algorithm already produces these values; e.g. for
 * e = −0.3 mm, N = 10: M = −1, k = 7, reading = −1 + 0.7 = −0.3 = −(10 − 7) × 0.1.
 */
import type { Rng } from '../rng';
import { describeZeroError, generateZeroOffset, type ZeroErrorInfo, type ZeroErrorSettings } from '../zeroCommon';
import { leastCount, type VernierConfig } from './config';
import { readVernier } from './reading';

/** Random zero errors are 1 … 6 least counts (SPEC §5.4). */
export const VERNIER_MAX_ZE_DIVISIONS = 6;

export function generateVernierZeroOffset(rng: Rng, settings: ZeroErrorSettings, c: VernierConfig): number {
  return generateZeroOffset(rng, settings, leastCount(c), VERNIER_MAX_ZE_DIVISIONS);
}

/** The zero error a careful student reads with the jaws closed. */
export function vernierZeroError(zeroOffsetMm: number, c: VernierConfig): ZeroErrorInfo {
  const closed = readVernier(zeroOffsetMm, c);
  return describeZeroError(closed.counts, c.n, leastCount(c));
}
