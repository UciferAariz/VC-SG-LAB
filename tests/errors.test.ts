import { describe, expect, it } from 'vitest';
import {
  absoluteErrors,
  analyseReadings,
  deriveQuantity,
  DERIVED_INPUTS,
  formatResult,
  formatSig,
  mean,
  meanAbsoluteError,
  roundUncertainty,
  sampleStdDev,
} from '../src/core/errors';

describe('Error analysis (SPEC §14.5)', () => {
  it('E1: [2.73, 2.74, 2.72, 2.73, 2.75] mm, LC 0.01 → (2.73 ± 0.01) mm', () => {
    const a = analyseReadings([2.73, 2.74, 2.72, 2.73, 2.75], 0.01);
    expect(a.mean).toBeCloseTo(2.734, 12);
    const expected = [0.004, 0.006, 0.014, 0.004, 0.016];
    a.absErrors.forEach((x, i) => expect(x).toBeCloseTo(expected[i]!, 12));
    expect(a.meanAbsError).toBeCloseTo(0.0088, 12);
    expect(a.relativeError).toBeCloseTo(0.003219, 6);
    expect(a.percentError).toBeCloseTo(0.32, 2);
    expect(a.usedLeastCount).toBe(true);
    expect(a.reportedMean).toBe(2.73);
    expect(a.reportedError).toBe(0.01);
    expect(formatResult('d', a.reportedMean, a.reportedError, a.decimals, 'mm')).toBe('d = (2.73 ± 0.01) mm');
  });

  it('E2: [2.10, 2.13, 2.08, 2.16, 2.12] cm → (2.12 ± 0.02) cm', () => {
    const a = analyseReadings([2.1, 2.13, 2.08, 2.16, 2.12], 0.01);
    expect(a.mean).toBeCloseTo(2.118, 12);
    // NOTE: SPEC E2 quotes Δā = 0.0216, but Σ|Δaᵢ| = 0.018+0.012+0.038+0.042+0.002 = 0.112,
    // so Δā = 0.0224 (see DECISIONS.md). The reported result is unaffected.
    expect(a.meanAbsError).toBeCloseTo(0.0224, 12);
    expect(a.usedLeastCount).toBe(false);
    expect(formatResult('d', a.reportedMean, a.reportedError, a.decimals, 'cm')).toBe('d = (2.12 ± 0.02) cm');
  });

  it('E3: sphere, d = (2.12 ± 0.02) cm → ΔV/V ≈ 2.83 %', () => {
    const r = deriveQuantity('sphereVolume', { d: { value: 2.12, error: 0.02 } }, 'cm');
    expect(r.relError).toBeCloseTo((3 * 0.02) / 2.12, 12);
    expect(r.percentError).toBeCloseTo(2.83, 2);
    expect(r.value).toBeCloseTo((Math.PI / 6) * 2.12 ** 3, 12);
    expect(r.unit).toBe('cm³');
    expect(r.resultText).toBe('V = (4.99 ± 0.14) cm³');
    expect(r.steps.map((s) => s.label)).toContain('Relative error (maximum-error rule)');
    expect(r.steps[2]!.symbolic).toBe('ΔV/V = 3 Δd/d');
  });

  it('E4: wire area, d = (0.52 ± 0.01) mm → ΔA/A ≈ 3.85 %', () => {
    const r = deriveQuantity('wireArea', { d: { value: 0.52, error: 0.01 } }, 'mm');
    expect(r.percentError).toBeCloseTo(3.85, 2);
    expect(r.unit).toBe('mm²');
    expect(r.steps[2]!.symbolic).toBe('ΔA/A = 2 Δd/d');
  });

  it('cylinder, block and beaker propagate additively', () => {
    const cyl = deriveQuantity('cylinderVolume', { d: { value: 2, error: 0.01 }, L: { value: 5, error: 0.01 } }, 'cm');
    expect(cyl.relError).toBeCloseTo(2 * 0.005 + 0.002, 12);
    expect(cyl.steps[2]!.symbolic).toBe('ΔV/V = 2 Δd/d + ΔL/L');
    const blk = deriveQuantity('blockVolume', { l: { value: 4, error: 0.01 }, b: { value: 2, error: 0.01 }, h: { value: 1, error: 0.01 } }, 'cm');
    expect(blk.value).toBeCloseTo(8, 12);
    expect(blk.relError).toBeCloseTo(0.0025 + 0.005 + 0.01, 12);
    const bkr = deriveQuantity('beakerVolume', { D: { value: 5, error: 0.01 }, h: { value: 6, error: 0.01 } }, 'cm');
    expect(bkr.relError).toBeCloseTo(2 * 0.002 + 0.01 / 6, 12);
    expect(DERIVED_INPUTS.beakerVolume).toEqual(['D', 'h']);
    expect(() => deriveQuantity('beakerVolume', { D: { value: 5, error: 0.01 } }, 'cm')).toThrow(/missing input "h"/);
  });

  it('tube internal volume and cross-sectional area (hair, needle, lead)', () => {
    const tube = deriveQuantity('tubeVolume', { d: { value: 2, error: 0.01 }, L: { value: 5, error: 0.01 } }, 'cm');
    expect(tube.name).toBe('Internal volume of tube');
    expect(tube.value).toBeCloseTo(5 * Math.PI, 12);
    expect(tube.steps[0]!.numeric).toBe('V = (π/4) × (2.000)² × 5.000');
    expect(DERIVED_INPUTS.tubeVolume).toEqual(['d', 'L']);
    const area = deriveQuantity('circleArea', { d: { value: 0.07, error: 0.01 } }, 'mm');
    expect(area.name).toBe('Cross-sectional area');
    expect(area.value).toBeCloseTo((Math.PI / 4) * 0.0049, 12);
    expect(area.steps[0]!.numeric).toBe('A = (π/4) × (0.07000)²');
    expect(area.unit).toBe('mm²');
  });

  it('helpers: mean, absolute errors, σ, uncertainty rounding, working format', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(() => mean([])).toThrow();
    expect(absoluteErrors([1, 3])).toEqual([1, 1]);
    expect(meanAbsoluteError([1, 3])).toBe(1);
    expect(sampleStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4);
    expect(sampleStdDev([5])).toBe(0);
    expect(roundUncertainty(0.141)).toEqual({ value: 0.14, decimals: 2 });
    expect(roundUncertainty(0.0372)).toEqual({ value: 0.04, decimals: 2 });
    expect(roundUncertainty(0)).toEqual({ value: 0, decimals: 0 });
    expect(formatSig(4.98876, 4)).toBe('4.989');
    expect(formatSig(0.0283019, 3)).toBe('0.0283');
    expect(formatSig(12345.6, 3)).toBe('12300');
    expect(formatSig(0)).toBe('0');
  });

  it('σ is available alongside the NCERT values', () => {
    const a = analyseReadings([2.73, 2.74, 2.72, 2.73, 2.75], 0.01);
    expect(a.stdDev).toBeCloseTo(0.011402, 5);
    expect(a.reportedPercentError).toBeCloseTo((0.01 / 2.73) * 100, 12);
  });
});
