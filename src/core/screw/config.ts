/**
 * Screw gauge configurations (SPEC §6.1). Store { pitch, n }; LC = pitch / N.
 */

export type ScrewPresetId = 'standard' | 'altA' | 'fine';

/** 'mm+half': mm marks above the datum line and half-mm marks below. */
export type LinearMarkStyle = 'mm+half' | 'mm';

export interface ScrewConfig {
  id: ScrewPresetId;
  label: string;
  /** Pitch, mm per revolution. */
  pitch: number;
  /** Divisions on the circular (thimble) scale. */
  n: number;
  linearMarks: LinearMarkStyle;
}

export const SCREW_PRESETS: Record<ScrewPresetId, ScrewConfig> = {
  standard: { id: 'standard', label: 'Standard (pitch 0.5 mm, 50 div)', pitch: 0.5, n: 50, linearMarks: 'mm+half' },
  altA: { id: 'altA', label: 'Alt-A (pitch 1 mm, 100 div)', pitch: 1, n: 100, linearMarks: 'mm' },
  fine: { id: 'fine', label: 'Fine (pitch 0.5 mm, 100 div)', pitch: 0.5, n: 100, linearMarks: 'mm+half' },
};

export const DEFAULT_SCREW: ScrewConfig = SCREW_PRESETS.standard;

/** Measuring range 0–25 mm. */
export const SCREW_RANGE_MM = 25;

export function screwLeastCount(c: ScrewConfig): number {
  return c.pitch / c.n;
}

/** Circular-scale numbering step: every 5th division (0, 5, 10 … 45 for N = 50). */
export function circularLabelEvery(c: ScrewConfig): number {
  return c.n >= 100 ? 10 : 5;
}
