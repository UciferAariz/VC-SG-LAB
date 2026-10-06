/**
 * Screw gauge reading (SPEC §6.3).
 *
 *   r   = p / pitch                 revolutions from zero
 *   R0  = floor(r)                  whole revolutions
 *   c   = round((r − R0) × N)       circular scale reading (division on the datum line)
 *   if c == N: R0 += 1, c = 0
 *   PSR = R0 × pitch
 *   reading = PSR + c × LC          = (R0·N + c) least counts, exact
 *
 * Division j is on the datum line when φ_j = j·360/N − θ = 0, i.e. j = r·N
 * (mod N), so the nearest division is round(frac(r)·N) — the same rule.
 *
 * Pitch-scale trap: with pitch 0.5 mm, a visible half-mm mark (below the
 * datum line) adds 0.5 mm to the PSR. R0 × pitch already includes it.
 */
import { countsToMm, floorEps, roundHalfUp } from '../units';
import { screwLeastCount, type ScrewConfig } from './config';

export interface ScrewReading {
  /** Pitch scale reading, mm. */
  psrMm: number;
  /** Circular scale reading (division on the datum line). */
  csr: number;
  lcMm: number;
  observedMm: number;
  /** (r − R0) × N, unrounded — for "estimate" explanations. */
  csrFraction: number;
  /** Observed reading in least counts (R0·N + CSR). */
  counts: number;
  /** Whole revolutions R0. */
  revolutions: number;
  /** True when the PSR includes a half-mm mark (pitch 0.5 gauges). */
  halfMmVisible: boolean;
}

export function readScrew(pMm: number, c: ScrewConfig): ScrewReading {
  const lc = screwLeastCount(c);
  const r = pMm / c.pitch;
  let R0 = floorEps(r);
  const csrFraction = (r - R0) * c.n;
  let csr = roundHalfUp(csrFraction);
  if (csr === c.n) {
    R0 += 1;
    csr = 0;
  }
  const counts = R0 * c.n + csr;
  const psrMm = countsToMm(R0 * c.n, lc);
  const halfMmVisible = c.pitch === 0.5 && R0 > 0 && R0 % 2 === 1;
  return { psrMm, csr, lcMm: lc, observedMm: countsToMm(counts, lc), csrFraction, counts, revolutions: R0, halfMmVisible };
}
