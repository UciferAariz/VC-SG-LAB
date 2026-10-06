import { describe, expect, it } from 'vitest';
import { countSigFigs, decimalsForSigFigs, decimalsOf, formatFixed, roundToDecimals, roundToSigFigs } from '../src/core/sigfig';
import {
  countsToMm,
  decimalsForLc,
  floorEps,
  formatLength,
  formatLengthWithUnit,
  formatSignedLength,
  fromUnit,
  roundHalfUp,
  sameLength,
  toUnit,
} from '../src/core/units';

describe('Significant figures (SPEC §7.4, E6)', () => {
  it('E6: countSigFigs', () => {
    expect(countSigFigs('0.0500')).toBe(3);
    expect(countSigFigs('2.30')).toBe(3);
    expect(countSigFigs('100')).toBe(1); // ambiguous: trailing zeros without a point are not counted
    expect(countSigFigs('100.')).toBe(3);
    expect(countSigFigs('1.00e2')).toBe(3);
    expect(countSigFigs('-0.0040')).toBe(2);
    expect(countSigFigs('.5')).toBe(1);
    expect(countSigFigs('0.00')).toBe(1);
    expect(countSigFigs('1203')).toBe(4);
    expect(() => countSigFigs('abc')).toThrow();
  });

  it('roundToDecimals: half away from zero, float noise removed', () => {
    expect(roundToDecimals(2.675, 2)).toBe(2.68);
    expect(roundToDecimals(1.005, 2)).toBe(1.01);
    expect(roundToDecimals(-2.675, 2)).toBe(-2.68);
    expect(roundToDecimals(2.734, 2)).toBe(2.73);
    expect(roundToDecimals(1234.5, -1)).toBe(1230);
    expect(Object.is(roundToDecimals(-0.0001, 2), -0)).toBe(false);
    expect(roundToDecimals(Infinity, 2)).toBe(Infinity);
  });

  it('roundToSigFigs', () => {
    expect(roundToSigFigs(0.0283019, 3)).toBe(0.0283);
    expect(roundToSigFigs(4.98876, 3)).toBe(4.99);
    expect(roundToSigFigs(9.996, 3)).toBe(10);
    expect(roundToSigFigs(12345, 2)).toBe(12000);
    expect(roundToSigFigs(0, 3)).toBe(0);
    expect(roundToSigFigs(-0.00456, 1)).toBe(-0.005);
    expect(() => roundToSigFigs(1, 0)).toThrow();
    expect(decimalsForSigFigs(0.0283, 3)).toBe(4);
    expect(decimalsForSigFigs(0, 3)).toBe(0);
  });

  it('formatFixed: exact decimals, no artefacts, no "-0"', () => {
    expect(formatFixed(2.7300000000000004, 2)).toBe('2.73');
    expect(formatFixed(0.1 + 0.2, 1)).toBe('0.3');
    expect(formatFixed(-0.04, 2)).toBe('-0.04');
    expect(formatFixed(-0.001, 2)).toBe('0.00');
    expect(formatFixed(0, 0)).toBe('0');
    expect(formatFixed(41.6, 0)).toBe('42');
    expect(formatFixed(0.005, 3)).toBe('0.005');
    expect(formatFixed(NaN, 2)).toBe('NaN');
    expect(() => formatFixed(1, -1)).toThrow();
  });

  it('decimalsOf', () => {
    expect([0.1, 0.05, 0.02, 0.01, 0.005, 0.5, 1].map(decimalsOf)).toEqual([1, 2, 2, 2, 3, 1, 0]);
    expect(decimalsOf(Math.PI)).toBe(12);
  });
});

describe('Units (SPEC §4.1)', () => {
  it('converts and formats with LC-derived decimals', () => {
    expect(toUnit(23.5, 'cm')).toBe(2.35);
    expect(fromUnit(2.35, 'cm')).toBe(23.5);
    expect(decimalsForLc(0.1, 'mm')).toBe(1);
    expect(decimalsForLc(0.1, 'cm')).toBe(2);
    expect(decimalsForLc(0.05, 'cm')).toBe(3);
    expect(decimalsForLc(0.01, 'mm')).toBe(2);
    expect(formatLength(23.5, 'cm', 0.1)).toBe('2.35');
    expect(formatLength(24, 'mm', 0.1)).toBe('24.0');
    expect(formatLengthWithUnit(2.73, 'mm', 0.01)).toBe('2.73 mm');
    expect(formatSignedLength(-0.04, 'mm', 0.01)).toBe('−0.04');
    expect(formatSignedLength(0.3, 'cm', 0.1)).toBe('+0.03');
    expect(formatSignedLength(0, 'mm', 0.01)).toBe('0.00');
  });

  it('counts → mm is exact; robust rounding helpers', () => {
    expect(countsToMm(247, 0.05)).toBe(12.35);
    expect(countsToMm(-4, 0.01)).toBe(-0.04);
    expect(countsToMm(273, 0.01)).toBe(2.73);
    expect(roundHalfUp(4.499999999999993)).toBe(5);
    expect(roundHalfUp(4.4)).toBe(4);
    expect(floorEps(4.9999999999999)).toBe(5);
    expect(sameLength(2.73, 2.7300000001, 0.01)).toBe(true);
    expect(sameLength(2.73, 2.74, 0.01)).toBe(false);
  });
});
