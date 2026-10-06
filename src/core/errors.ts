/**
 * Error analysis (SPEC §7) — NCERT Class 11, "Units and Measurements".
 *
 *   mean                ā    = Σaᵢ / n
 *   absolute errors     |Δaᵢ| = |ā − aᵢ|
 *   mean absolute error Δā   = Σ|Δaᵢ| / n
 *   relative error      δa   = Δā / ā
 *   percentage error         = δa × 100 %
 *
 * Reporting rule: the uncertainty cannot be smaller than the least count, so
 * the reported error is max(Δā, LC), rounded to the LC's decimal place; the
 * mean is rounded to the same decimal place.
 *
 * Derived quantities use maximum-error (additive) propagation as in NCERT:
 *   Z = Aᵖ·Bᑫ  ⇒  ΔZ/Z = p·ΔA/A + q·ΔB/B
 */
import { decimalsForSigFigs, decimalsOf, formatFixed, roundToDecimals, roundToSigFigs } from './sigfig';

export interface ErrorAnalysis {
  n: number;
  readings: number[];
  mean: number;
  absErrors: number[];
  meanAbsError: number;
  relativeError: number;
  percentError: number;
  /** Sample standard deviation (n − 1). Beyond NCERT scope; shown only on request. */
  stdDev: number;
  lc: number;
  /** Decimal places of the LC — used for the final result. */
  decimals: number;
  /** True when Δā < LC and the LC was used as the uncertainty. */
  usedLeastCount: boolean;
  reportedMean: number;
  reportedError: number;
  /** Percentage error of the reported result: reportedError / reportedMean × 100. */
  reportedPercentError: number;
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error('mean of no readings');
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function absoluteErrors(xs: readonly number[], m = mean(xs)): number[] {
  return xs.map((x) => Math.abs(m - x));
}

export function meanAbsoluteError(xs: readonly number[]): number {
  return mean(absoluteErrors(xs));
}

export function sampleStdDev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/**
 * Full analysis of n corrected readings, all in the same unit as `lc`.
 */
export function analyseReadings(readings: readonly number[], lc: number): ErrorAnalysis {
  const m = mean(readings);
  const abs = absoluteErrors(readings, m);
  const mae = mean(abs);
  const decimals = decimalsOf(lc);
  const usedLeastCount = mae < lc - 1e-12;
  const reportedError = roundToDecimals(Math.max(mae, lc), decimals);
  const reportedMean = roundToDecimals(m, decimals);
  return {
    n: readings.length,
    readings: [...readings],
    mean: m,
    absErrors: abs,
    meanAbsError: mae,
    relativeError: mae / m,
    percentError: (mae / m) * 100,
    stdDev: sampleStdDev(readings),
    lc,
    decimals,
    usedLeastCount,
    reportedMean,
    reportedError,
    reportedPercentError: (reportedError / reportedMean) * 100,
  };
}

/** "d = (2.73 ± 0.01) mm" */
export function formatResult(symbol: string, value: number, error: number, decimals: number, unit: string): string {
  return `${symbol} = (${formatFixed(value, decimals)} ± ${formatFixed(error, decimals)}) ${unit}`;
}

/** Format a working value to `s` significant figures (never in exponent form). */
export function formatSig(x: number, s = 4): string {
  if (x === 0) return '0';
  return formatFixed(roundToSigFigs(x, s), Math.max(0, decimalsForSigFigs(x, s)));
}

// ── Error propagation ───────────────────────────────────────────────────────

export interface Measured {
  value: number;
  error: number;
}

export type DerivedKind = 'sphereVolume' | 'cylinderVolume' | 'wireArea' | 'circleArea' | 'blockVolume' | 'beakerVolume' | 'tubeVolume';

export interface WorkingStep {
  label: string;
  symbolic: string;
  numeric: string;
}

export interface DerivedResult {
  kind: DerivedKind;
  name: string;
  symbol: string;
  unit: string;
  value: number;
  relError: number;
  percentError: number;
  absError: number;
  /** Rounded result: error to 1 s.f. (2 if it starts with 1), value to the same decimal place. */
  reportedValue: number;
  reportedError: number;
  reportedDecimals: number;
  steps: WorkingStep[];
  resultText: string;
}

interface Term {
  /** Symbol of the measured quantity (d, L …). */
  sym: string;
  m: Measured;
  /** Power the quantity is raised to. */
  power: number;
}

interface DerivedSpec {
  name: string;
  symbol: string;
  formula: string;
  /** Formula with numbers, from the input values. */
  valueText: (t: Term[]) => string;
  compute: (t: Term[]) => number;
  terms: (inputs: Record<string, Measured>) => Term[];
  dimensionPower: number;
}

function need(inputs: Record<string, Measured>, key: string): Measured {
  const v = inputs[key];
  if (!v) throw new Error(`missing input "${key}"`);
  return v;
}

const f4 = (x: number) => formatSig(x, 4);

const SPECS: Record<DerivedKind, DerivedSpec> = {
  sphereVolume: {
    name: 'Volume of sphere', symbol: 'V', dimensionPower: 3,
    formula: 'V = (4/3)πr³ = (π/6)d³',
    terms: (i) => [{ sym: 'd', m: need(i, 'd'), power: 3 }],
    compute: ([d]) => (Math.PI / 6) * d!.m.value ** 3,
    valueText: ([d]) => `(π/6) × (${f4(d!.m.value)})³`,
  },
  cylinderVolume: {
    name: 'Volume of cylinder', symbol: 'V', dimensionPower: 3,
    formula: 'V = (π/4)d²L',
    terms: (i) => [{ sym: 'd', m: need(i, 'd'), power: 2 }, { sym: 'L', m: need(i, 'L'), power: 1 }],
    compute: ([d, L]) => (Math.PI / 4) * d!.m.value ** 2 * L!.m.value,
    valueText: ([d, L]) => `(π/4) × (${f4(d!.m.value)})² × ${f4(L!.m.value)}`,
  },
  wireArea: {
    name: 'Cross-sectional area of wire', symbol: 'A', dimensionPower: 2,
    formula: 'A = (π/4)d²',
    terms: (i) => [{ sym: 'd', m: need(i, 'd'), power: 2 }],
    compute: ([d]) => (Math.PI / 4) * d!.m.value ** 2,
    valueText: ([d]) => `(π/4) × (${f4(d!.m.value)})²`,
  },
  circleArea: {
    name: 'Cross-sectional area', symbol: 'A', dimensionPower: 2,
    formula: 'A = (π/4)d²',
    terms: (i) => [{ sym: 'd', m: need(i, 'd'), power: 2 }],
    compute: ([d]) => (Math.PI / 4) * d!.m.value ** 2,
    valueText: ([d]) => `(π/4) × (${f4(d!.m.value)})²`,
  },
  blockVolume: {
    name: 'Volume of block', symbol: 'V', dimensionPower: 3,
    formula: 'V = l · b · h',
    terms: (i) => [
      { sym: 'l', m: need(i, 'l'), power: 1 },
      { sym: 'b', m: need(i, 'b'), power: 1 },
      { sym: 'h', m: need(i, 'h'), power: 1 },
    ],
    compute: ([l, b, h]) => l!.m.value * b!.m.value * h!.m.value,
    valueText: ([l, b, h]) => `${f4(l!.m.value)} × ${f4(b!.m.value)} × ${f4(h!.m.value)}`,
  },
  beakerVolume: {
    name: 'Internal volume of beaker', symbol: 'V', dimensionPower: 3,
    formula: 'V = (π/4)D²h',
    terms: (i) => [{ sym: 'D', m: need(i, 'D'), power: 2 }, { sym: 'h', m: need(i, 'h'), power: 1 }],
    compute: ([D, h]) => (Math.PI / 4) * D!.m.value ** 2 * h!.m.value,
    valueText: ([D, h]) => `(π/4) × (${f4(D!.m.value)})² × ${f4(h!.m.value)}`,
  },
  tubeVolume: {
    name: 'Internal volume of tube', symbol: 'V', dimensionPower: 3,
    formula: 'V = (π/4)d²L',
    terms: (i) => [{ sym: 'd', m: need(i, 'd'), power: 2 }, { sym: 'L', m: need(i, 'L'), power: 1 }],
    compute: ([d, L]) => (Math.PI / 4) * d!.m.value ** 2 * L!.m.value,
    valueText: ([d, L]) => `(π/4) × (${f4(d!.m.value)})² × ${f4(L!.m.value)}`,
  },
};

/** Inputs needed for each derived quantity, by symbol. */
export const DERIVED_INPUTS: Record<DerivedKind, string[]> = {
  sphereVolume: ['d'],
  cylinderVolume: ['d', 'L'],
  wireArea: ['d'],
  circleArea: ['d'],
  blockVolume: ['l', 'b', 'h'],
  beakerVolume: ['D', 'h'],
  tubeVolume: ['d', 'L'],
};

/** Round an uncertainty: 1 significant figure, or 2 when the first digit is 1. */
export function roundUncertainty(err: number): { value: number; decimals: number } {
  if (err === 0) return { value: 0, decimals: 0 };
  const first = roundToSigFigs(err, 1);
  const sf = Math.abs(first) < 2 * 10 ** Math.floor(Math.log10(Math.abs(first))) ? 2 : 1;
  const decimals = decimalsForSigFigs(err, sf);
  return { value: roundToDecimals(err, decimals), decimals };
}

const SUPERSCRIPT: Record<number, string> = { 1: '', 2: '²', 3: '³' };

/**
 * Compute a derived quantity with step-by-step working.
 * All inputs must share one length unit (`unit`, e.g. "cm").
 */
export function deriveQuantity(kind: DerivedKind, inputs: Record<string, Measured>, unit: string): DerivedResult {
  const spec = SPECS[kind];
  const terms = spec.terms(inputs);
  const value = spec.compute(terms);
  const parts = terms.map((t) => t.power * (t.m.error / t.m.value));
  const relError = parts.reduce((s, x) => s + x, 0);
  const absError = relError * value;
  const outUnit = `${unit}${SUPERSCRIPT[spec.dimensionPower] ?? ''}`;
  const S = spec.symbol;

  const relSymbolic = terms.map((t) => `${t.power === 1 ? '' : `${t.power} `}Δ${t.sym}/${t.sym}`).join(' + ');
  const relNumeric = terms
    .map((t) => `${t.power === 1 ? '' : `${t.power} × `}${f4(t.m.error)}/${f4(t.m.value)}`)
    .join(' + ');

  const rounded = roundUncertainty(absError);
  const reportedDecimals = Math.max(0, rounded.decimals);
  const reportedValue = roundToDecimals(value, rounded.decimals);
  const reportedError = rounded.value;

  const steps: WorkingStep[] = [
    { label: 'Formula', symbolic: spec.formula, numeric: `${S} = ${spec.valueText(terms)}` },
    { label: 'Value', symbolic: `${S}`, numeric: `${S} = ${f4(value)} ${outUnit}` },
    { label: 'Relative error (maximum-error rule)', symbolic: `Δ${S}/${S} = ${relSymbolic}`, numeric: `Δ${S}/${S} = ${relNumeric} = ${formatSig(relError, 3)}` },
    { label: 'Percentage error', symbolic: `(Δ${S}/${S}) × 100 %`, numeric: `${formatSig(relError * 100, 3)} %` },
    { label: 'Absolute error', symbolic: `Δ${S} = (Δ${S}/${S}) × ${S}`, numeric: `Δ${S} = ${formatSig(relError, 3)} × ${f4(value)} = ${formatSig(absError, 3)} ${outUnit}` },
  ];

  return {
    kind,
    name: spec.name,
    symbol: S,
    unit: outUnit,
    value,
    relError,
    percentError: relError * 100,
    absError,
    reportedValue,
    reportedError,
    reportedDecimals,
    steps,
    resultText: formatResult(S, reportedValue, reportedError, reportedDecimals, outUnit),
  };
}
