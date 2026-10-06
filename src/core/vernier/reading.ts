/**
 * Vernier reading (SPEC §5.3).
 *
 * The SOURCE OF TRUTH is a search: look at every vernier mark k = 0 … N and
 * pick the one that lies closest to any main-scale mark — exactly what a
 * careful student does with a magnifier. The closed-form formula
 *   M = floor(x/MSD), f = x/MSD − M, k = round(f × N)
 * is kept only as a cross-check (tests G3).
 *
 * ── Why round(f × N) is the best line ──────────────────────────────────────
 * Let x = (M + f)·MSD and LC = MSD/N. Vernier mark k sits at
 *     x + k·VSD = x + k(γ·MSD − LC) = (M + γk)·MSD + (f·N − k)·LC.
 * So its distance to main mark (M + γk) is (f·N − k)·LC. Taken modulo MSD
 * these N + 1 distances are all different (they step by LC, and N·LC = MSD,
 * so only k = 0 and k = N coincide — they are the same reading). Hence the
 * line of minimum |misalignment| is the k minimising |f·N − k|, which is
 * k = round(f·N), and its misalignment is at most LC/2 < MSD/2, so (M + γk) is
 * indeed its nearest main mark. This holds for γ = 1 and γ = 2.
 *
 * Reading from the coincidence: if mark k meets main mark m_c, then
 *     x ≈ m_c·MSD − k·VSD = (m_c − γk)·MSD + k·LC
 * so M = m_c − γk and the reading is M·MSD + k·LC — an integer number of
 * least counts, (M·N + k), with no float drift.
 *
 * Tie-break (SPEC V10): when two neighbouring lines are equally misaligned
 * (x exactly on a half-LC boundary) the HIGHER k wins — "round half up".
 */
import { countsToMm, EPS, floorEps, roundHalfUp } from '../units';
import { leastCount, vsd, type VernierConfig } from './config';
import { coincidenceMisalignment, nearestMainMark } from './geometry';

export interface Misalignment {
  /** Vernier mark index (physical, 0 … N). */
  k: number;
  /** Signed distance to nearest main mark, mm (+ = vernier mark to the right). */
  deltaMm: number;
}

export interface VernierReading {
  /** Main scale reading M × MSD, mm (negative only for negative zero error). */
  msrMm: number;
  /** Coinciding vernier division (0 … N−1 after the k = N rollover). */
  vsr: number;
  lcMm: number;
  /** MSR + VSR × LC, mm. */
  observedMm: number;
  /** Misalignment of the coinciding physical line and its neighbours (k−1, k, k+1). */
  misalignments: Misalignment[];
  /** Observed reading as an integer number of least counts (M·N + VSR). */
  counts: number;
  /** M, in main-scale divisions. */
  mainIndex: number;
  /** The physical vernier mark that coincides (0 … N; N before rollover). */
  coincidingMark: number;
  /** The main-scale mark it coincides with. */
  coincidingMainMark: number;
}

/** Find the best-coinciding vernier mark by searching all k (source of truth). */
export function findCoincidence(x: number, c: VernierConfig): { k: number; deltaMm: number } {
  const tieTol = EPS * leastCount(c);
  let bestK = 0;
  let best = Infinity;
  for (let k = 0; k <= c.n; k++) {
    const d = Math.abs(coincidenceMisalignment(x, k, c));
    // `<=` with tolerance: a tie goes to the higher k (round half up).
    if (d <= best + tieTol) {
      bestK = k;
      best = Math.min(best, d);
    }
  }
  return { k: bestK, deltaMm: coincidenceMisalignment(x, bestK, c) };
}

/** Read the vernier with its zero at x (mm). */
export function readVernier(x: number, c: VernierConfig): VernierReading {
  const lc = leastCount(c);
  const { k: kPhys } = findCoincidence(x, c);
  const mC = nearestMainMark(x + kPhys * vsd(c), c.msd);
  let M = mC - c.gamma * kPhys;
  let k = kPhys;
  if (k === c.n) {
    // Mark N coinciding is the same as mark 0 coinciding one MSD further on.
    M += 1;
    k = 0;
  }
  const counts = M * c.n + k;
  const misalignments: Misalignment[] = [];
  for (let j = Math.max(0, kPhys - 1); j <= Math.min(c.n, kPhys + 1); j++) {
    misalignments.push({ k: j, deltaMm: coincidenceMisalignment(x, j, c) });
  }
  return {
    msrMm: countsToMm(M * c.n, lc),
    vsr: k,
    lcMm: lc,
    observedMm: countsToMm(counts, lc),
    misalignments,
    counts,
    mainIndex: M,
    coincidingMark: kPhys,
    coincidingMainMark: mC,
  };
}

/** Closed-form reading in least counts. Cross-check only (see header). */
export function readVernierFormula(x: number, c: VernierConfig): { counts: number; mainIndex: number; vsr: number } {
  let M = floorEps(x / c.msd);
  const f = x / c.msd - M;
  let k = roundHalfUp(f * c.n);
  if (k === c.n) {
    M += 1;
    k = 0;
  }
  return { counts: M * c.n + k, mainIndex: M, vsr: k };
}
