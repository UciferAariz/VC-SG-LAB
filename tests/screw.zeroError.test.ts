import { describe, expect, it } from 'vitest';
import { SCREW_PRESETS, screwLeastCount } from '../src/core/screw/config';
import { generateScrewZeroOffset, screwZeroError, SCREW_MAX_ZE_DIVISIONS } from '../src/core/screw/zeroError';
import { divisionOffset } from '../src/core/screw/geometry';
import { readScrew } from '../src/core/screw/reading';
import { Rng } from '../src/core/rng';
import { correctedMm } from '../src/core/zeroCommon';

const { standard, fine } = SCREW_PRESETS;

describe('Screw gauge zero error (SPEC §6.4)', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('positive ZE of %i div: zero below datum, ZE = +n × LC', (n) => {
    const lc = screwLeastCount(standard);
    const e = (n + 0.1) * lc;
    const ze = screwZeroError(e, standard);
    expect(ze.kind).toBe('positive');
    expect(ze.n).toBe(n);
    expect(divisionOffset(0, e, standard)).toBeGreaterThan(0);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('negative ZE of %i div: zero above datum, ZE = −(N − n) × LC', (d) => {
    const lc = screwLeastCount(standard);
    const e = -(d + 0.1) * lc;
    const ze = screwZeroError(e, standard);
    expect(ze.kind).toBe('negative');
    expect(ze.n).toBe(50 - d);
    expect(ze.counts).toBe(-d);
    expect(divisionOffset(0, e, standard)).toBeLessThan(0);
  });

  it('random generation: sign by mode, magnitude 1–8 divisions, unambiguous', () => {
    const rng = new Rng(77);
    for (const c of [standard, fine]) {
      const lc = screwLeastCount(c);
      for (let i = 0; i < 300; i++) {
        const e = generateScrewZeroOffset(rng, { mode: 'random' }, c);
        const div = Math.abs(e) / lc;
        expect(div).toBeGreaterThanOrEqual(0.85);
        expect(div).toBeLessThanOrEqual(SCREW_MAX_ZE_DIVISIONS + 0.15);
        expect(Math.abs(screwZeroError(e, c).counts)).toBe(Math.round(div));
      }
      expect(generateScrewZeroOffset(rng, { mode: 'positive' }, c)).toBeGreaterThan(0);
      expect(generateScrewZeroOffset(rng, { mode: 'negative' }, c)).toBeLessThan(0);
    }
  });

  it('corrected reading = observed − ZE (both signs)', () => {
    // Wire 0.82 mm, ZE +0.04: observed 0.86, corrected 0.82.
    const plus = readScrew(0.82 + 0.04, standard);
    expect(plus.observedMm).toBe(0.86);
    expect(correctedMm(plus.counts, screwZeroError(0.04, standard).counts, plus.lcMm)).toBe(0.82);
    // ZE −0.04: observed 0.78, corrected 0.82.
    const minus = readScrew(0.82 - 0.04, standard);
    expect(minus.observedMm).toBe(0.78);
    expect(correctedMm(minus.counts, screwZeroError(-0.04, standard).counts, minus.lcMm)).toBe(0.82);
  });
});
