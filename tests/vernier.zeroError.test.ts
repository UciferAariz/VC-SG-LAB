import { describe, expect, it } from 'vitest';
import { VERNIER_PRESETS, leastCount } from '../src/core/vernier/config';
import { generateVernierZeroOffset, vernierZeroError, VERNIER_MAX_ZE_DIVISIONS } from '../src/core/vernier/zeroError';
import { readVernier } from '../src/core/vernier/reading';
import { Rng } from '../src/core/rng';
import { correctedCounts } from '../src/core/zeroCommon';

const { standard, fine20, fine50 } = VERNIER_PRESETS;

describe('Vernier zero error (SPEC §5.4)', () => {
  it('no offset → no zero error', () => {
    const ze = vernierZeroError(0, standard);
    expect(ze.kind).toBe('none');
    expect(ze.zeMm).toBe(0);
    expect(Object.is(ze.correctionMm, -0)).toBe(false);
  });

  it.each([1, 2, 3, 4, 5, 6])('positive ZE of %i divisions: ZE = +n × LC', (n) => {
    for (const c of [standard, fine20, fine50]) {
      const lc = leastCount(c);
      const ze = vernierZeroError(n * lc + 0.1 * lc, c);
      expect(ze.kind).toBe('positive');
      expect(ze.n).toBe(n);
      expect(ze.counts).toBe(n);
    }
  });

  it.each([1, 2, 3, 4, 5, 6])('negative ZE of %i divisions: ZE = −(N − n) × LC', (d) => {
    for (const c of [standard, fine20, fine50]) {
      const lc = leastCount(c);
      const ze = vernierZeroError(-d * lc - 0.1 * lc, c);
      expect(ze.kind).toBe('negative');
      expect(ze.n).toBe(c.n - d);
      expect(ze.counts).toBe(-(c.n - ze.n));
    }
  });

  it('corrected = observed − ZE, in exact counts', () => {
    expect(correctedCounts(416, 3)).toBe(413);
    expect(correctedCounts(416, -3)).toBe(419);
  });

  it('random generation honours the mode and the 1–6 LC magnitude', () => {
    const rng = new Rng(1234);
    const lc = leastCount(standard);
    for (let i = 0; i < 500; i++) {
      const pos = generateVernierZeroOffset(rng, { mode: 'positive' }, standard);
      const neg = generateVernierZeroOffset(rng, { mode: 'negative' }, standard);
      const any = generateVernierZeroOffset(rng, { mode: 'random' }, standard);
      expect(pos).toBeGreaterThan(0);
      expect(neg).toBeLessThan(0);
      for (const e of [pos, neg, any]) {
        expect(Math.abs(e)).toBeGreaterThanOrEqual(0.85 * lc);
        expect(Math.abs(e)).toBeLessThanOrEqual((VERNIER_MAX_ZE_DIVISIONS + 0.15) * lc);
        // Unambiguous: the zero error read is the nearest whole number of LCs.
        expect(Math.abs(vernierZeroError(e, standard).counts)).toBe(Math.round(Math.abs(e) / lc));
      }
    }
    expect(generateVernierZeroOffset(rng, { mode: 'none' }, standard)).toBe(0);
  });

  it('custom zero error: divisions and sign', () => {
    const rng = new Rng(9);
    const e = generateVernierZeroOffset(rng, { mode: 'custom', custom: { divisions: 4, sign: -1 } }, standard);
    expect(vernierZeroError(e, standard).counts).toBe(-4);
    expect(vernierZeroError(e, standard).n).toBe(6);
    expect(generateVernierZeroOffset(rng, { mode: 'custom', custom: { divisions: 0, sign: 1 } }, standard)).toBe(0);
    expect(generateVernierZeroOffset(rng, { mode: 'custom' }, standard)).toBe(0);
  });

  it('closed jaws with negative ZE: vernier zero is left of main zero (MSR −1 mm)', () => {
    const r = readVernier(-0.42, standard);
    expect(r.observedMm).toBe(-0.4);
    expect(r.msrMm).toBe(-1);
  });
});
