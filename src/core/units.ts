/**
 * Shared constants and unit handling.
 * All internal lengths are millimetres (SPEC §4.1).
 */
import { decimalsOf, formatFixed, roundToDecimals } from './sigfig';

/** Tolerance for floating-point comparisons. */
export const EPS = 1e-9;

export type LengthUnit = 'mm' | 'cm';

export const MM_PER: Record<LengthUnit, number> = { mm: 1, cm: 10 };

export function toUnit(valueMm: number, unit: LengthUnit): number {
  return valueMm / MM_PER[unit];
}

export function fromUnit(value: number, unit: LengthUnit): number {
  return value * MM_PER[unit];
}

/** Decimals justified by a least count when shown in `unit` (0.1 mm in cm → 2). */
export function decimalsForLc(lcMm: number, unit: LengthUnit): number {
  return decimalsOf(toUnit(lcMm, unit));
}

/**
 * Format a length for display with exactly the decimals the least count
 * justifies. e.g. formatLength(23.5, 'cm', 0.1) → "2.35".
 */
export function formatLength(valueMm: number, unit: LengthUnit, lcMm: number): string {
  return formatFixed(toUnit(valueMm, unit), decimalsForLc(lcMm, unit));
}

/** formatLength plus the unit symbol: "2.35 cm". */
export function formatLengthWithUnit(valueMm: number, unit: LengthUnit, lcMm: number): string {
  return `${formatLength(valueMm, unit, lcMm)} ${unit}`;
}

/** Signed version for zero errors: "+0.03 cm", "−0.04 mm" (true minus sign). */
export function formatSignedLength(valueMm: number, unit: LengthUnit, lcMm: number): string {
  const s = formatLength(Math.abs(valueMm), unit, lcMm);
  const zero = Number(s) === 0;
  if (zero) return s;
  return (valueMm < 0 ? '−' : '+') + s;
}

/**
 * Exact length from an integer number of least counts. Readings are built
 * from integer counts (SPEC §4.1) and only turned into mm here, rounded to the
 * LC's decimals so no float drift survives.
 */
export function countsToMm(counts: number, lcMm: number): number {
  return roundToDecimals(counts * lcMm, decimalsOf(lcMm) + 1);
}

/** Round-half-up on a value that may carry float noise (ties go to the larger integer). */
export function roundHalfUp(v: number): number {
  return Math.floor(v + 0.5 + EPS);
}

/** Floor that is robust to float noise just below an integer. */
export function floorEps(v: number): number {
  return Math.floor(v + EPS);
}

/** True when two lengths are equal within a fraction of the least count. */
export function sameLength(aMm: number, bMm: number, lcMm: number): boolean {
  return Math.abs(aMm - bMm) < lcMm * 1e-3;
}
