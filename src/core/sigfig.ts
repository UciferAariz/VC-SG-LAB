/**
 * Rounding and significant-figure helpers.
 *
 * Every number shown to a student goes through these functions so that
 * JavaScript float artefacts (2.7300000000000004) never leak into the UI.
 *
 * Rounding rule: round half AWAY from zero (2.675 → 2.68, −2.675 → −2.68).
 * The tiny float error in products like 2.675 × 100 = 267.49999999999997 is
 * removed first by re-reading the product at 12 significant figures, which is
 * far more precision than any reading in this lab needs.
 */

/** Strip binary float noise from a value that "should" be a short decimal. */
function denoise(x: number): number {
  return Number(x.toPrecision(12));
}

/** Integer nearest to x, ties away from zero, float noise removed first. */
function roundHalfAwayInt(x: number): number {
  const v = denoise(x);
  const r = Math.floor(Math.abs(v) + 0.5);
  return v < 0 ? -r : r;
}

/** Round to `d` decimal places (d may be negative: −1 rounds to tens). */
export function roundToDecimals(x: number, d: number): number {
  if (!Number.isFinite(x)) return x;
  const n = roundHalfAwayInt(scaleBy10(x, d));
  const out = scaleBy10(n, -d);
  return out === 0 ? 0 : denoise(out); // normalise −0 → 0
}

/** x × 10^d computed so that the result for integer d is as exact as possible. */
function scaleBy10(x: number, d: number): number {
  return d >= 0 ? x * 10 ** d : x / 10 ** -d;
}

/** Round to `s` significant figures. */
export function roundToSigFigs(x: number, s: number): number {
  if (!Number.isFinite(x) || x === 0) return x === 0 ? 0 : x;
  if (s < 1) throw new RangeError('significant figures must be ≥ 1');
  const d = s - 1 - Math.floor(Math.log10(Math.abs(denoise(x))));
  return roundToDecimals(x, d);
}

/** Decimal place (as used by roundToDecimals) of the s-th significant figure of x. */
export function decimalsForSigFigs(x: number, s: number): number {
  if (x === 0) return 0;
  const r = roundToSigFigs(x, s);
  return s - 1 - Math.floor(Math.log10(Math.abs(r)));
}

/**
 * Format x with EXACTLY `d` decimals (d ≥ 0), built from an integer so the
 * output can never contain float artefacts or "-0".
 */
export function formatFixed(x: number, d: number): string {
  if (!Number.isFinite(x)) return String(x);
  if (d < 0 || !Number.isInteger(d)) throw new RangeError('decimals must be a non-negative integer');
  const n = roundHalfAwayInt(scaleBy10(x, d));
  if (n === 0) return d === 0 ? '0' : '0.' + '0'.repeat(d);
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(n).toString().padStart(d + 1, '0');
  if (d === 0) return sign + digits;
  return sign + digits.slice(0, digits.length - d) + '.' + digits.slice(digits.length - d);
}

/**
 * Number of decimal places needed to write `step` exactly
 * (0.1 → 1, 0.05 → 2, 0.005 → 3, 0.5 → 1, 1 → 0).
 */
export function decimalsOf(step: number): number {
  for (let d = 0; d <= 12; d++) {
    const scaled = step * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return d;
  }
  return 12;
}

/**
 * Count significant figures in a number WRITTEN AS A STRING.
 *
 * - Leading zeros are never significant ("0.0500" → 3).
 * - Trailing zeros after a decimal point are significant ("2.30" → 3).
 * - Trailing zeros in an integer WITHOUT a decimal point are treated as NOT
 *   significant ("100" → 1). This is ambiguous in physics; write "100." or
 *   "1.00e2" to mean three significant figures.
 * - A value of zero ("0", "0.00") is given as 1 significant figure.
 * - Scientific notation is supported: only the mantissa is counted.
 */
export function countSigFigs(input: string): number {
  let s = input.trim().replace(/^[+-]/, '');
  const exp = s.search(/[eE]/);
  if (exp >= 0) s = s.slice(0, exp);
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error(`Not a number: "${input}"`);
  const hasPoint = s.includes('.');
  let digits = s.replace('.', '').replace(/^0+/, '');
  if (digits === '') return 1;
  if (!hasPoint) digits = digits.replace(/0+$/, '');
  return digits.length;
}
