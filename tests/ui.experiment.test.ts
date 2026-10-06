import { describe, expect, it } from 'vitest';
import { parseDivisionInput, parseNumberInput } from '../src/ui/parse';
import {
  analyse,
  clampReadings,
  derivedResult,
  missingForDerived,
  recordProblem,
  rowFromSnapshot,
  sameAsLastPlacement,
  tableColumns,
  type Experiment,
  type ObsRow,
  type QuantityRecord,
} from '../src/ui/experimentModel';
import { buildCsv, printSheet, resultSummary, resultText } from '../src/ui/export';
import { errorWorkings } from '../src/ui/errorWorkings';
import { answerText, hintFor, workedSolution } from '../src/ui/practiceText';
import { describeZeroError } from '../src/core/zeroCommon';
import type { LabSnapshot } from '../src/ui/lab';
import type { MistakeCode } from '../src/core/practice';

const row = (correctedMm: number, extra: Partial<ObsRow> = {}): ObsRow => ({
  direction: null,
  msrMm: 0,
  vsr: 0,
  observedMm: correctedMm,
  correctedMm,
  source: 'auto',
  placementKey: String(Math.random()),
  ...extra,
});

function screwExp(readings: number[], kind = 'wire'): Experiment {
  return {
    instrument: 'screw',
    unit: 'mm',
    lcMm: 0.01,
    N: 50,
    pitchMm: 0.5,
    configLabel: 'Standard',
    objectKind: kind,
    objectLabel: 'Copper wire',
    aimNoun: 'the diameter of a given copper wire',
    derived: kind === 'wire' ? 'wireArea' : null,
    readingsWanted: readings.length,
    ze: describeZeroError(0, 50, 0.01),
    quantities: [{ dimId: 'diameter', dimLabel: 'Diameter', symbol: 'd', rows: readings.map((r) => row(r)) }],
  };
}

function snap(over: Partial<LabSnapshot> = {}): LabSnapshot {
  return {
    instrument: 'vernier',
    unit: 'cm',
    lcMm: 0.1,
    N: 10,
    msdMm: 1,
    gamma: 1,
    configKey: 'standard',
    configLabel: 'Standard',
    msrMm: 23,
    vsr: 5,
    observedMm: 23.5,
    ze: describeZeroError(-3, 10, 0.1),
    correctedMm: 23.8,
    trueMm: 23.47,
    objectKind: 'bob',
    dimId: 'diameter',
    touching: true,
    closed: false,
    placementKey: 'bob:diameter:0',
    direction: null,
    halfMmVisible: false,
    compressionMm: 0,
    locked: false,
    ...over,
  };
}

describe('input parsing', () => {
  it('accepts minus signs, decimal commas, units; rejects junk', () => {
    expect(parseNumberInput(' 2.35 ')).toBe(2.35);
    expect(parseNumberInput('−0.03')).toBe(-0.03);
    expect(parseNumberInput('2,35 cm')).toBe(2.35);
    expect(parseNumberInput('+0.04mm')).toBe(0.04);
    expect(parseNumberInput('.5')).toBe(0.5);
    expect(parseNumberInput('')).toBeNaN();
    expect(parseNumberInput('abc')).toBeNaN();
    expect(parseNumberInput('1.2.3')).toBeNaN();
    expect(parseDivisionInput('7')).toBe(7);
    expect(parseDivisionInput('7.5')).toBeNaN();
  });
});

describe('experiment model (SPEC §8.3)', () => {
  it('E1 through the experiment: (2.73 ± 0.01) mm', () => {
    const exp = screwExp([2.73, 2.74, 2.72, 2.73, 2.75]);
    const a = analyse(exp, exp.quantities[0]!)!;
    expect(a.mean).toBeCloseTo(2.734, 12);
    expect(a.meanAbsError).toBeCloseTo(0.0088, 12);
    expect(resultText(exp, exp.quantities[0]!)).toBe('d = (2.73 ± 0.01) mm');
  });

  it('needs at least 3 readings; clamps the wanted count to 3–10', () => {
    const exp = screwExp([2.73, 2.74]);
    expect(analyse(exp, exp.quantities[0]!)).toBeNull();
    expect(clampReadings(1)).toBe(3);
    expect(clampReadings(12)).toBe(10);
    expect(clampReadings(NaN)).toBe(5);
  });

  it('screw table has the NCERT columns including direction', () => {
    const exp = screwExp([2.73]);
    exp.quantities[0]!.rows = [row(2.69, { direction: 'perp', msrMm: 2.5, vsr: 23, observedMm: 2.73 })];
    const t = tableColumns(exp, exp.quantities[0]!);
    expect(t.head).toEqual(['S.No', 'Direction (∥/⊥)', 'PSR (mm)', 'CSR (n)', 'n × LC (mm)', 'Observed (mm)', 'Corrected (mm)']);
    expect(t.rows[0]).toEqual(['1', '⊥', '2.50', '23', '23 × 0.01 = 0.23', '2.73', '2.69']);
  });

  it('vernier table in cm', () => {
    const exp: Experiment = { ...screwExp([]), instrument: 'vernier', unit: 'cm', lcMm: 0.1, N: 10, objectKind: 'bob', derived: 'sphereVolume' };
    exp.quantities[0]!.rows = [row(23.8, { msrMm: 23, vsr: 5, observedMm: 23.5 })];
    const t = tableColumns(exp, exp.quantities[0]!);
    expect(t.head[1]).toBe('MSR (cm)');
    expect(t.rows[0]).toEqual(['1', '2.30', '5', '5 × 0.01 = 0.05', '2.35', '2.38']);
  });

  it('wire area propagation: d = (0.52 ± 0.01) mm → ΔA/A ≈ 3.85 % (E4)', () => {
    const exp = screwExp([0.52, 0.52, 0.52]);
    expect(missingForDerived(exp)).toEqual([]);
    const dr = derivedResult(exp)!;
    expect(dr.percentError).toBeCloseTo(3.846, 2);
    const block: Experiment = { ...screwExp([1, 1, 1]), derived: 'blockVolume' };
    expect(missingForDerived(block)).toEqual(['l', 'b', 'h']);
    expect(derivedResult(block)).toBeNull();
  });

  it('recording rules: needs ZE, contact, no squash, room in the table', () => {
    const exp = screwExp([2.73, 2.74, 2.72]);
    exp.readingsWanted = 5;
    const q = exp.quantities[0]!;
    const s = snap({ instrument: 'screw', unit: 'mm', lcMm: 0.01, objectKind: 'wire', placementKey: 'k' });
    expect(recordProblem(exp, q, s)).toBeNull();
    expect(recordProblem({ ...exp, ze: null }, q, s)).toBe('no-ze');
    expect(recordProblem(exp, q, { ...s, touching: false })).toBe('not-touching');
    expect(recordProblem(exp, q, { ...s, compressionMm: 0.01 })).toBe('squashed');
    expect(recordProblem({ ...exp, readingsWanted: 3 }, q, s)).toBe('table-full');
    const q2: QuantityRecord = { ...q, rows: [rowFromSnapshot(s)] };
    expect(sameAsLastPlacement(q2, s)).toBe(true);
    expect(sameAsLastPlacement(q2, { ...s, placementKey: 'k2' })).toBe(false);
  });

  it('CSV, summary and print sheet: branded, complete, no float artefacts', () => {
    const exp = screwExp([0.52, 0.53, 0.51, 0.52, 0.54]);
    const csv = buildCsv(exp);
    expect(csv.startsWith('﻿Riz Lab')).toBe(true);
    expect(csv).toContain('S.No,Direction (∥/⊥),PSR (mm),CSR (n)');
    expect(csv).toContain('d = (0.52 ± 0.01) mm');
    expect(csv).toContain('Cross-sectional area of wire');
    expect(csv).not.toMatch(/\d\.\d{9,}/);
    expect(csv).not.toContain('NaN');
    const sum = resultSummary(exp);
    expect(sum).toContain('Riz Lab: Screw gauge, Copper wire');
    expect(sum).toContain('d = (0.52 ± 0.01) mm');
    const sheet = printSheet(exp);
    expect(sheet.header).toBe('Riz Lab');
    expect(sheet.aim).toBe('To measure the diameter of a given copper wire using a screw gauge.');
    expect(sheet.tables).toHaveLength(1);
    expect(sheet.derived?.result).toMatch(/^A = /);
    expect(sheet.precautions.length).toBeGreaterThanOrEqual(4);
  });

  it('workings show both the raw working values and the rounded result', () => {
    const exp = screwExp([2.73, 2.74, 2.72, 2.73, 2.75]);
    const w = errorWorkings(analyse(exp, exp.quantities[0]!)!, 'd', 'mm');
    expect(w[0]!.numeric).toBe('d̄ = (2.73 + 2.74 + 2.72 + 2.73 + 2.75) / 5 = 2.7340 mm');
    expect(w[2]!.numeric).toContain('= 0.0088 mm');
    expect(w[5]!.numeric).toContain('smaller than LC');
    expect(w.at(-1)!.numeric).toBe('d = (2.73 ± 0.01) mm');
  });
});

describe('practice wording (SPEC §8.2)', () => {
  it('every mistake code has its own targeted hint', () => {
    const codes: MistakeCode[] = ['sign-ze', 'added-ze', 'division-number', 'half-mm', 'n-vs-N-minus-n', 'unit', 'near-line', 'unknown'];
    const s = snap();
    const hints = codes.map((m) => hintFor('ze', { verdict: 'wrong', mistake: m }, s));
    expect(new Set(hints).size).toBe(codes.length);
    expect(hintFor('ze', { verdict: 'correct', mistake: null }, s)).toBe('Correct!');
  });

  it('worked solutions use the NCERT rules and signs', () => {
    const s = snap();
    expect(workedSolution('ze', s)).toContain('ZE = −(N − n) × LC = −(10 − 7) × 0.01 cm = −0.03 cm');
    expect(workedSolution('corrected', s)).toBe('Corrected = Observed − ZE = 2.35 cm − (−0.03 cm) = 2.38 cm.');
    expect(workedSolution('observed', s)).toBe('Observed = MSR + VSR × LC = 2.30 cm + 5 × 0.01 cm = 2.35 cm.');
    expect(answerText('ze', s)).toBe('−0.03 cm');
    const screw = snap({ instrument: 'screw', unit: 'mm', lcMm: 0.01, N: 50, pitchMm: 0.5, msrMm: 2.5, vsr: 23, observedMm: 2.73, halfMmVisible: true, ze: describeZeroError(4, 50, 0.01) });
    expect(workedSolution('msr', screw)).toContain('half-mm mark');
    expect(workedSolution('msr', screw)).toContain('PSR = 2 + 0.5 = 2.50 mm');
    expect(workedSolution('ze', screw)).toContain('below the datum line');
    expect(workedSolution('lc', screw)).toBe('LC = pitch / N = 0.5 mm / 50 = 0.01 mm.');
  });
});
