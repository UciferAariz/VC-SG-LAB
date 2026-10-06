import { describe, expect, it } from 'vitest';
import { VERNIER_PRESETS, leastCount } from '../src/core/vernier/config';
import { readVernier, readVernierFormula } from '../src/core/vernier/reading';
import { vernierZeroPosition } from '../src/core/vernier/geometry';
import { vernierZeroError } from '../src/core/vernier/zeroError';
import { correctedMm } from '../src/core/zeroCommon';
import { formatLength } from '../src/core/units';

const { standard, fine20, fine50, spread20 } = VERNIER_PRESETS;

describe('Vernier reading (SPEC §14.1)', () => {
  it('V1: 10/9, gap 23.47 → MSR 23, VSR 5, observed 23.5 mm', () => {
    const r = readVernier(23.47, standard);
    expect(r.msrMm).toBe(23);
    expect(r.vsr).toBe(5);
    expect(r.observedMm).toBe(23.5);
    expect(leastCount(standard)).toBeCloseTo(0.1, 12);
  });

  it('V2: gap 23.96 → MSR 24, VSR 0, observed 24.0 (k = N rollover)', () => {
    const r = readVernier(23.96, standard);
    expect(r.msrMm).toBe(24);
    expect(r.vsr).toBe(0);
    expect(r.observedMm).toBe(24);
    expect(r.coincidingMark).toBe(10); // physically, mark N is the coinciding line
    expect(formatLength(r.observedMm, 'mm', r.lcMm)).toBe('24.0');
  });

  it('V3: gap 0, e = +0.30 → ZE = +0.3 mm (n = 3)', () => {
    const ze = vernierZeroError(0.3, standard);
    expect(ze.kind).toBe('positive');
    expect(ze.n).toBe(3);
    expect(ze.zeMm).toBe(0.3);
    expect(ze.correctionMm).toBe(-0.3);
  });

  it('V4: gap 0, e = −0.30 → ZE = −0.3 mm (n = 7, −(10−7)×0.1)', () => {
    const r = readVernier(-0.3, standard);
    expect(r.mainIndex).toBe(-1);
    expect(r.vsr).toBe(7);
    expect(r.observedMm).toBe(-0.3);
    const ze = vernierZeroError(-0.3, standard);
    expect(ze.kind).toBe('negative');
    expect(ze.n).toBe(7);
    expect(ze.zeMm).toBeCloseTo(-(ze.N - ze.n) * ze.lcMm, 12);
    expect(ze.zeMm).toBe(-0.3);
    expect(ze.correctionMm).toBe(0.3);
  });

  it('V5: e = +0.3, gap 41.3 → observed 41.6, corrected 41.3', () => {
    const r = readVernier(vernierZeroPosition(41.3, 0.3), standard);
    const ze = vernierZeroError(0.3, standard);
    expect(r.observedMm).toBe(41.6);
    expect(correctedMm(r.counts, ze.counts, r.lcMm)).toBe(41.3);
  });

  it('V6: e = −0.3, gap 41.9 → observed 41.6, corrected 41.9', () => {
    const r = readVernier(vernierZeroPosition(41.9, -0.3), standard);
    const ze = vernierZeroError(-0.3, standard);
    expect(r.observedMm).toBe(41.6);
    expect(correctedMm(r.counts, ze.counts, r.lcMm)).toBe(41.9);
  });

  it('V7: 20/19, LC 0.05, gap 12.37 → VSR 7, observed 12.35', () => {
    const r = readVernier(12.37, fine20);
    expect(r.lcMm).toBe(0.05);
    expect(r.msrMm).toBe(12);
    expect(r.vsr).toBe(7);
    expect(r.observedMm).toBe(12.35);
  });

  it('V8: 50/49, LC 0.02, gap 7.531 → VSR 27, observed 7.54', () => {
    const r = readVernier(7.531, fine50);
    expect(r.lcMm).toBe(0.02);
    expect(r.vsr).toBe(27);
    expect(r.observedMm).toBe(7.54);
  });

  it('V9: spread 20/39, gap 12.37 → same reading as V7', () => {
    const r = readVernier(12.37, spread20);
    expect(r.vsr).toBe(7);
    expect(r.observedMm).toBe(12.35);
    expect(r.observedMm).toBe(readVernier(12.37, fine20).observedMm);
    // On the spread scale, mark 7 meets main mark 12 + 2×7 = 26.
    expect(r.coincidingMainMark).toBe(26);
  });

  it('V10: exact half-LC boundary → round half up (higher line wins)', () => {
    // 23.45 mm lies exactly between lines 4 and 5 (each misaligned by 0.05 mm).
    const r = readVernier(23.45, standard);
    expect(r.vsr).toBe(5);
    expect(r.observedMm).toBe(23.5);
    expect(readVernierFormula(23.45, standard).vsr).toBe(5);
    // Same rule on the 20-division scales: 12.375 is between lines 7 and 8.
    expect(readVernier(12.375, fine20).vsr).toBe(8);
    expect(readVernier(12.375, spread20).vsr).toBe(8);
  });

  it('returns misalignments for the best line and its neighbours', () => {
    const r = readVernier(23.47, standard);
    expect(r.misalignments.map((m) => m.k)).toEqual([4, 5, 6]);
    const best = r.misalignments.find((m) => m.k === 5)!;
    for (const m of r.misalignments) expect(Math.abs(best.deltaMm)).toBeLessThanOrEqual(Math.abs(m.deltaMm));
    expect(best.deltaMm).toBeCloseTo(-0.03, 9);
    // At the end of the scale only the one existing neighbour is listed.
    expect(readVernier(24.0, standard).misalignments.map((m) => m.k)).toEqual([9, 10]);
  });

  it('formats in cm with the LC-justified decimals', () => {
    const r = readVernier(23.47, standard);
    expect(formatLength(r.observedMm, 'cm', r.lcMm)).toBe('2.35');
    expect(formatLength(readVernier(12.37, fine20).observedMm, 'cm', 0.05)).toBe('1.235');
  });
});
