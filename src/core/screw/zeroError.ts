/**
 * Screw gauge zero error (SPEC §6.4).
 *
 * With the faces touching (s = 0) the scale position is p = e.
 *  - Positive ZE: circular zero lies BELOW the datum line; the datum reads n → ZE = +n × LC.
 *    The thimble edge is just past the linear-scale zero (zero mark fully visible).
 *  - Negative ZE: circular zero lies ABOVE the datum line; the datum reads n → ZE = −(N − n) × LC.
 *    The thimble edge slightly covers the linear-scale zero mark.
 * e.g. e = −0.04 mm, N = 50, pitch 0.5: r = −0.08, R0 = −1, c = 46 → −0.5 + 0.46 = −0.04.
 */
import type { Rng } from '../rng';
import { describeZeroError, generateZeroOffset, type ZeroErrorInfo, type ZeroErrorSettings } from '../zeroCommon';
import { screwLeastCount, type ScrewConfig } from './config';
import { readScrew } from './reading';

/** Random zero errors are 1 … 8 circular divisions (SPEC §6.4). */
export const SCREW_MAX_ZE_DIVISIONS = 8;

export function generateScrewZeroOffset(rng: Rng, settings: ZeroErrorSettings, c: ScrewConfig): number {
  return generateZeroOffset(rng, settings, screwLeastCount(c), SCREW_MAX_ZE_DIVISIONS);
}

export function screwZeroError(zeroOffsetMm: number, c: ScrewConfig): ZeroErrorInfo {
  return describeZeroError(readScrew(zeroOffsetMm, c).counts, c.n, screwLeastCount(c));
}
