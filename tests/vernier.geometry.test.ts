import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { VERNIER_PRESETS, leastCount, maxGapMm, spanMsd, vsd, vernierSpanMm, MAIN_SCALE_RANGE_MM } from '../src/core/vernier/config';
import { clampGap, coincidenceMisalignment, mainTicks, nearestMainMark, vernierTicks } from '../src/core/vernier/geometry';
import { findCoincidence, readVernier, readVernierFormula } from '../src/core/vernier/reading';
import { EPS } from '../src/core/units';

const configs = Object.values(VERNIER_PRESETS);

describe('Vernier geometry (SPEC §14.2)', () => {
  it('G1: vernier mark 0 → mark N spans exactly (γN − 1) MSD', () => {
    for (const c of configs) {
      const ticks = vernierTicks(17.3, c);
      const span = ticks[c.n]!.posMm - ticks[0]!.posMm;
      expect(Math.abs(span - spanMsd(c) * c.msd)).toBeLessThan(EPS);
      expect(Math.abs(vernierSpanMm(c) - (c.gamma * c.n - 1) * c.msd)).toBeLessThan(EPS);
      expect(Math.abs(c.gamma * c.msd - vsd(c) - leastCount(c))).toBeLessThan(EPS);
    }
    expect(vsd(VERNIER_PRESETS.standard)).toBeCloseTo(0.9, 12);
    expect(vsd(VERNIER_PRESETS.spread20)).toBeCloseTo(1.95, 12);
  });

  it('G2: the chosen line is misaligned by ≤ LC/2 for all x in [0, 150] (10,000 samples)', () => {
    for (const c of configs) {
      fc.assert(
        fc.property(fc.double({ min: 0, max: MAIN_SCALE_RANGE_MM, noNaN: true }), (x) => {
          const { deltaMm } = findCoincidence(x, c);
          return Math.abs(deltaMm) <= leastCount(c) / 2 + 1e-9;
        }),
        { numRuns: 10_000 },
      );
    }
  });

  it('G3: search-based and formula-based coincidence agree (γ = 1; also checked for γ = 2)', () => {
    for (const c of configs) {
      fc.assert(
        fc.property(fc.double({ min: -0.9, max: MAIN_SCALE_RANGE_MM, noNaN: true }), (x) => {
          const s = readVernier(x, c);
          const f = readVernierFormula(x, c);
          return s.counts === f.counts && s.vsr === f.vsr && s.mainIndex === f.mainIndex;
        }),
        { numRuns: 10_000 },
      );
    }
  });

  it('main scale: 0–150 mm, tick sizes and cm labels, nothing left of zero', () => {
    const t = mainTicks();
    expect(t).toHaveLength(151);
    expect(t[0]).toMatchObject({ posMm: 0, size: 'long', label: '0' });
    expect(t[5]).toMatchObject({ size: 'medium', label: null });
    expect(t[7]).toMatchObject({ size: 'short', label: null });
    expect(t[150]).toMatchObject({ posMm: 150, label: '15' });
    expect(t.every((x) => x.posMm >= 0)).toBe(true);
    expect(t.filter((x) => x.label !== null).map((x) => x.label)).toEqual(Array.from({ length: 16 }, (_, i) => String(i)));
  });

  it('vernier labels run 0–10 for N = 10, 20, 50', () => {
    for (const c of configs) {
      const labels = vernierTicks(0, c).filter((t) => t.label !== null);
      expect(labels.map((t) => t.label)).toEqual(Array.from({ length: 11 }, (_, i) => String(i)));
      expect(labels[1]!.index).toBe(c.n / 10);
    }
    const t10 = vernierTicks(0, VERNIER_PRESETS.standard);
    expect([t10[0]!.size, t10[3]!.size, t10[5]!.size]).toEqual(['long', 'medium', 'long']);
    const t50 = vernierTicks(0, VERNIER_PRESETS.fine50);
    expect([t50[1]!.size, t50[5]!.size, t50[25]!.size]).toEqual(['short', 'medium', 'long']);
  });

  it('misalignment sign: + means the vernier mark is right of the main mark', () => {
    const c = VERNIER_PRESETS.standard;
    expect(coincidenceMisalignment(23.47, 4, c)).toBeCloseTo(0.07, 9);
    expect(coincidenceMisalignment(23.47, 5, c)).toBeCloseTo(-0.03, 9);
    expect(nearestMainMark(-0.6, 1)).toBe(0); // no marks left of zero
  });

  it('jaws clamp on the object: outer ≥ size, inner/depth ≤ size, within range', () => {
    const c = VERNIER_PRESETS.standard;
    expect(clampGap(10, c, 'outer', 20.13)).toBe(20.13);
    expect(clampGap(30, c, 'outer', 20.13)).toBe(30);
    expect(clampGap(60, c, 'inner', 48.2)).toBe(48.2);
    expect(clampGap(40, c, 'inner', 48.2)).toBe(40);
    expect(clampGap(90, c, 'depth', 65.5)).toBe(65.5);
    expect(clampGap(-3, c, null, null)).toBe(0);
    expect(clampGap(500, c, null, null)).toBe(maxGapMm(c));
    for (const k of configs) expect(maxGapMm(k) + vernierSpanMm(k)).toBeLessThanOrEqual(MAIN_SCALE_RANGE_MM);
  });
});
