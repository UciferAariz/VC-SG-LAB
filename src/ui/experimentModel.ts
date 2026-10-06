/**
 * Experiment mode data (SPEC §8.3): the observation table, error analysis and
 * derived quantity. Pure functions over plain data — every number comes from
 * core/ (readings from the instrument snapshot, analysis from core/errors).
 */
import { analyseReadings, deriveQuantity, DERIVED_INPUTS, type DerivedKind, type DerivedResult, type ErrorAnalysis, type Measured } from '../core/errors';
import { formatLength, toUnit, type LengthUnit } from '../core/units';
import type { ZeroErrorInfo } from '../core/zeroCommon';
import type { InstrumentId, LabSnapshot } from './lab';

export interface ObsRow {
  direction: 'parallel' | 'perp' | null;
  msrMm: number;
  vsr: number;
  observedMm: number;
  correctedMm: number;
  source: 'auto' | 'manual';
  placementKey: string;
}

/** One measured quantity (e.g. "diameter d") within an experiment. */
export interface QuantityRecord {
  dimId: string;
  dimLabel: string;
  symbol: string;
  rows: ObsRow[];
}

export interface Experiment {
  instrument: InstrumentId;
  unit: LengthUnit;
  lcMm: number;
  N: number;
  pitchMm?: number;
  msdMm?: number;
  gamma?: number;
  configLabel: string;
  objectKind: string;
  objectLabel: string;
  aimNoun: string;
  derived: DerivedKind | null;
  readingsWanted: number;
  ze: ZeroErrorInfo | null;
  quantities: QuantityRecord[];
}

export const MIN_READINGS = 3;
export const MAX_READINGS = 10;

export function clampReadings(n: number): number {
  return Math.max(MIN_READINGS, Math.min(MAX_READINGS, Math.round(n) || 5));
}

/** A table row from the instrument's current state (auto-fill). */
export function rowFromSnapshot(s: LabSnapshot, source: ObsRow['source'] = 'auto'): ObsRow {
  return {
    direction: s.direction,
    msrMm: s.msrMm,
    vsr: s.vsr,
    observedMm: s.observedMm,
    correctedMm: s.correctedMm,
    source,
    placementKey: s.placementKey,
  };
}

export type RecordProblem = 'no-ze' | 'not-touching' | 'squashed' | 'table-full' | null;

/** Why the instrument's current state cannot be recorded as a reading, if it can't. */
export function recordProblem(exp: Experiment, q: QuantityRecord, s: LabSnapshot): RecordProblem {
  if (!exp.ze) return 'no-ze';
  if (q.rows.length >= exp.readingsWanted) return 'table-full';
  if (!s.objectKind || !s.touching) return 'not-touching';
  if (s.compressionMm > 1e-7) return 'squashed';
  return null;
}

/** True when the last row was taken at this same placement (SPEC §8.3: warn). */
export function sameAsLastPlacement(q: QuantityRecord, s: LabSnapshot): boolean {
  const last = q.rows.at(-1);
  return last !== undefined && last.placementKey === s.placementKey;
}

export interface TableColumns {
  head: string[];
  rows: string[][];
}

const DIR = { parallel: '∥', perp: '⊥' } as const;

/** Observation table with the NCERT columns for each instrument. */
export function tableColumns(exp: Experiment, q: QuantityRecord): TableColumns {
  const u = exp.unit;
  const lc = exp.lcMm;
  const f = (mm: number) => formatLength(mm, u, lc).replace(/^-/, '−');
  const lcTxt = f(lc);
  if (exp.instrument === 'vernier') {
    return {
      head: ['S.No', `MSR (${u})`, 'VSR (n)', `n × LC (${u})`, `Observed (${u})`, `Corrected (${u})`],
      rows: q.rows.map((r, i) => [String(i + 1), f(r.msrMm), String(r.vsr), `${r.vsr} × ${lcTxt} = ${f(r.vsr * lc)}`, f(r.observedMm), f(r.correctedMm)]),
    };
  }
  return {
    head: ['S.No', 'Direction (∥/⊥)', `PSR (${u})`, 'CSR (n)', `n × LC (${u})`, `Observed (${u})`, `Corrected (${u})`],
    rows: q.rows.map((r, i) => [String(i + 1), r.direction ? DIR[r.direction] : '–', f(r.msrMm), String(r.vsr), `${r.vsr} × ${lcTxt} = ${f(r.vsr * lc)}`, f(r.observedMm), f(r.correctedMm)]),
  };
}

/** Error analysis of the corrected readings, in the display unit. */
export function analyse(exp: Experiment, q: QuantityRecord): ErrorAnalysis | null {
  if (q.rows.length < MIN_READINGS) return null;
  const lcU = toUnit(exp.lcMm, exp.unit);
  return analyseReadings(
    q.rows.map((r) => toUnit(r.correctedMm, exp.unit)),
    lcU,
  );
}

/** Measured values (mean ± reported error, display unit) for each finished quantity, by symbol. */
export function measuredBySymbol(exp: Experiment): Record<string, Measured> {
  const out: Record<string, Measured> = {};
  for (const q of exp.quantities) {
    const a = analyse(exp, q);
    if (a && q.rows.length >= exp.readingsWanted) out[q.symbol] = { value: a.reportedMean, error: a.reportedError };
  }
  return out;
}

/** Symbols still needed for the derived quantity (empty when it can be computed). */
export function missingForDerived(exp: Experiment): string[] {
  if (!exp.derived) return [];
  const have = measuredBySymbol(exp);
  return DERIVED_INPUTS[exp.derived].filter((s) => !(s in have));
}

export function derivedResult(exp: Experiment): DerivedResult | null {
  if (!exp.derived || missingForDerived(exp).length > 0) return null;
  return deriveQuantity(exp.derived, measuredBySymbol(exp), exp.unit);
}
