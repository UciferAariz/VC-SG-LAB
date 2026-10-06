import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { VERNIER_PRESETS, leastCount, maxGapMm } from '../src/core/vernier/config';
import { readVernier } from '../src/core/vernier/reading';
import { vernierZeroError } from '../src/core/vernier/zeroError';
import { SCREW_PRESETS, SCREW_RANGE_MM, screwLeastCount } from '../src/core/screw/config';
import { readScrew } from '../src/core/screw/reading';
import { divisionOffset } from '../src/core/screw/geometry';
import { screwZeroError } from '../src/core/screw/zeroError';
import { correctedMm } from '../src/core/zeroCommon';
import { countsToMm, decimalsForLc, formatLength, type LengthUnit } from '../src/core/units';

const vConfigs = Object.values(VERNIER_PRESETS);
const sConfigs = Object.values(SCREW_PRESETS);
const LCS = [...vConfigs.map(leastCount), ...sConfigs.map(screwLeastCount)];

describe('Property tests', () => {
  it('E5: formatting never shows float artefacts (10,000 random readings)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2000, max: 30000 }),
        fc.constantFrom(...LCS),
        fc.constantFrom<LengthUnit>('mm', 'cm'),
        (counts, lc, unit) => {
          const mm = countsToMm(counts, lc);
          const s = formatLength(mm, unit, lc);
          const d = decimalsForLc(lc, unit);
          const re = d === 0 ? /^-?\d+$/ : new RegExp(`^-?\\d+\\.\\d{${d}}$`);
          if (!re.test(s)) return false;
          // The string is exactly the reading (no rounding of a quantised value).
          const expected = (counts * lc) / (unit === 'cm' ? 10 : 1);
          return Math.abs(Number(s) - expected) < 1e-9 && s !== '-0' && !s.startsWith('-0.' + '0'.repeat(d));
        },
      ),
      { numRuns: 10_000 },
    );
  });

  it('vernier: reading is within LC/2 of the true position, and an integer number of LCs', () => {
    for (const c of vConfigs) {
      const lc = leastCount(c);
      fc.assert(
        fc.property(fc.double({ min: 0, max: maxGapMm(c), noNaN: true }), (x) => {
          const r = readVernier(x, c);
          return Math.abs(r.observedMm - x) <= lc / 2 + 1e-9 && r.observedMm === countsToMm(r.counts, lc);
        }),
        { numRuns: 3000 },
      );
    }
  });

  it('vernier: corrected reading recovers the true gap to within one LC for any ZE', () => {
    for (const c of vConfigs) {
      const lc = leastCount(c);
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: maxGapMm(c) - 1, noNaN: true }),
          fc.integer({ min: -6, max: 6 }),
          fc.double({ min: -0.15, max: 0.15, noNaN: true }),
          (gap, div, jitter) => {
            const e = (div + jitter) * lc;
            const r = readVernier(gap + e, c);
            const ze = vernierZeroError(e, c);
            return Math.abs(correctedMm(r.counts, ze.counts, lc) - gap) <= lc + 1e-9;
          },
        ),
        { numRuns: 2000 },
      );
    }
  });

  it('screw: reading is within LC/2 of p and the datum division is the one nearest the line', () => {
    for (const c of sConfigs) {
      const lc = screwLeastCount(c);
      fc.assert(
        fc.property(fc.double({ min: 0, max: SCREW_RANGE_MM, noNaN: true }), (p) => {
          const r = readScrew(p, c);
          if (Math.abs(r.observedMm - p) > lc / 2 + 1e-9) return false;
          // The CSR division is the closest to the datum line (|y| smallest among neighbours).
          const y = Math.abs(divisionOffset(r.csr, p, c));
          const yUp = Math.abs(divisionOffset((r.csr + 1) % c.n, p, c));
          const yDn = Math.abs(divisionOffset((r.csr + c.n - 1) % c.n, p, c));
          return y <= yUp + 1e-9 && y <= yDn + 1e-9;
        }),
        { numRuns: 3000 },
      );
    }
  });

  it('screw: sign of ZE matches the side of the circular zero (below datum ⇔ positive)', () => {
    for (const c of sConfigs) {
      const lc = screwLeastCount(c);
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 8 }), fc.constantFrom(1, -1), fc.double({ min: -0.15, max: 0.15, noNaN: true }), (div, sign, j) => {
          const e = sign * (div + j) * lc;
          const ze = screwZeroError(e, c);
          const below = divisionOffset(0, e, c) > 0;
          return (ze.kind === 'positive') === below && ze.counts === sign * div;
        }),
        { numRuns: 1000 },
      );
    }
  });

  it('readings are monotone non-decreasing in position', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), fc.double({ min: 0, max: 5, noNaN: true }), (a, d) => {
        const v = VERNIER_PRESETS.standard;
        const s = SCREW_PRESETS.standard;
        return (
          readVernier(a + d, v).counts >= readVernier(a, v).counts &&
          readScrew((a + d) / 5, s).counts >= readScrew(a / 5, s).counts
        );
      }),
      { numRuns: 3000 },
    );
    expect(true).toBe(true);
  });
});
