/**
 * Vernier callipers configurations (SPEC §5.1).
 *
 * A config stores only { msd, n, gamma }; everything else is derived.
 * N vernier divisions span (γN − 1) main-scale divisions, so
 *   VSD = (γN − 1) × MSD / N
 *   LC  = γ × MSD − VSD = MSD / N
 */

export interface VernierConfig {
  id: VernierPresetId;
  label: string;
  /** Main scale division, mm. */
  msd: number;
  /** Number of vernier divisions. */
  n: number;
  /** Spread factor: 1 for ordinary verniers, 2 for "spread" (long) verniers. */
  gamma: 1 | 2;
}

export type VernierPresetId = 'standard' | 'fine20' | 'fine50' | 'spread20';

export const VERNIER_PRESETS: Record<VernierPresetId, VernierConfig> = {
  standard: { id: 'standard', label: 'Standard (10 VSD = 9 MSD)', msd: 1, n: 10, gamma: 1 },
  fine20: { id: 'fine20', label: 'Fine-20 (20 VSD = 19 MSD)', msd: 1, n: 20, gamma: 1 },
  fine50: { id: 'fine50', label: 'Fine-50 (50 VSD = 49 MSD)', msd: 1, n: 50, gamma: 1 },
  spread20: { id: 'spread20', label: 'Spread-20 (20 VSD = 39 MSD)', msd: 1, n: 20, gamma: 2 },
};

export const DEFAULT_VERNIER: VernierConfig = VERNIER_PRESETS.standard;

/** Length of the main scale, mm (0–15 cm). */
export const MAIN_SCALE_RANGE_MM = 150;

/** Vernier scale division, mm. */
export function vsd(c: VernierConfig): number {
  return ((c.gamma * c.n - 1) * c.msd) / c.n;
}

/** Least count, mm. */
export function leastCount(c: VernierConfig): number {
  return c.msd / c.n;
}

/** How many main-scale divisions the N vernier divisions cover: γN − 1. */
export function spanMsd(c: VernierConfig): number {
  return c.gamma * c.n - 1;
}

/** Physical length of the vernier scale (mark 0 to mark N), mm. */
export function vernierSpanMm(c: VernierConfig): number {
  return spanMsd(c) * c.msd;
}

/**
 * Largest jaw opening, mm. The whole vernier scale must stay over the
 * engraved main scale, so the opening is limited by the vernier's length.
 */
export function maxGapMm(c: VernierConfig): number {
  return MAIN_SCALE_RANGE_MM - vernierSpanMm(c) - 2 * c.msd;
}

/**
 * Vernier scale labelling (SPEC §5.1): 0–10 whatever N is.
 * N = 10 → every division; N = 20 → every 2nd; N = 50 → every 5th.
 */
export function vernierLabelEvery(c: VernierConfig): number {
  return c.n / 10;
}
