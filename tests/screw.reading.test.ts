import { describe, expect, it } from 'vitest';
import { SCREW_PRESETS, screwLeastCount } from '../src/core/screw/config';
import { readScrew } from '../src/core/screw/reading';
import {
  circularMarks,
  divisionOffset,
  isMarkUncovered,
  linearMarks,
  positionFromAngle,
  scalePosition,
  thimbleAngleDeg,
  wrapDeg,
  VISIBLE_COS,
} from '../src/core/screw/geometry';
import { screwZeroError } from '../src/core/screw/zeroError';
import { formatLength } from '../src/core/units';

const { standard, altA, fine } = SCREW_PRESETS;

describe('Screw gauge reading (SPEC §14.3)', () => {
  it('S1: 0.5/50, s = 2.734 → PSR 2.5, CSR 23, observed 2.73', () => {
    const r = readScrew(2.734, standard);
    expect(r.psrMm).toBe(2.5);
    expect(r.csr).toBe(23);
    expect(r.observedMm).toBe(2.73);
    expect(r.halfMmVisible).toBe(true);
    expect(r.csrFraction).toBeCloseTo(23.4, 9);
    expect(screwLeastCount(standard)).toBe(0.01);
  });

  it('S2: s = 2.996 → PSR 3.0, CSR 0, observed 3.00 (rollover)', () => {
    const r = readScrew(2.996, standard);
    expect(r.psrMm).toBe(3);
    expect(r.csr).toBe(0);
    expect(r.observedMm).toBe(3);
    expect(formatLength(r.observedMm, 'mm', r.lcMm)).toBe('3.00');
  });

  it('S3: s = 0, e = +0.04 → ZE +0.04; circular zero is BELOW the datum line', () => {
    const p = scalePosition(0, 0.04);
    const ze = screwZeroError(0.04, standard);
    expect(ze.kind).toBe('positive');
    expect(ze.zeMm).toBe(0.04);
    expect(ze.n).toBe(4);
    // SVG y grows downward: positive offset = below the datum line.
    expect(divisionOffset(0, p, standard)).toBeGreaterThan(0);
    const zero = circularMarks(p, standard).find((m) => m.j === 0)!;
    expect(zero.yOverR).toBeGreaterThan(0);
    // The datum line reads 4: division 4 sits on it.
    expect(Math.abs(divisionOffset(4, p, standard))).toBeLessThan(1e-9);
    // Thimble edge just past the linear zero: zero mark fully visible.
    expect(isMarkUncovered(0, p)).toBe(true);
  });

  it('S4: s = 0, e = −0.04 → ZE −0.04; datum reads 46; circular zero is ABOVE the datum line', () => {
    const p = scalePosition(0, -0.04);
    const r = readScrew(p, standard);
    expect(r.revolutions).toBe(-1);
    expect(r.csr).toBe(46);
    expect(r.observedMm).toBe(-0.04);
    const ze = screwZeroError(-0.04, standard);
    expect(ze.kind).toBe('negative');
    expect(ze.n).toBe(46);
    expect(ze.zeMm).toBeCloseTo(-(50 - 46) * 0.01, 12);
    expect(divisionOffset(0, p, standard)).toBeLessThan(0);
    expect(Math.abs(divisionOffset(46, p, standard))).toBeLessThan(1e-9);
    // Thimble edge slightly covers the linear-scale zero mark.
    expect(isMarkUncovered(0, p)).toBe(false);
  });

  it('S5: 1.0/100, s = 5.678 → PSR 5, CSR 68, observed 5.68', () => {
    const r = readScrew(5.678, altA);
    expect(r.psrMm).toBe(5);
    expect(r.csr).toBe(68);
    expect(r.observedMm).toBe(5.68);
    expect(r.halfMmVisible).toBe(false);
  });

  it('S6: 0.5/100, LC 0.005, s = 1.2345 → PSR 1.0, CSR 47, observed 1.235', () => {
    const r = readScrew(1.2345, fine);
    expect(r.lcMm).toBe(0.005);
    expect(r.psrMm).toBe(1);
    expect(r.csr).toBe(47);
    expect(r.observedMm).toBe(1.235);
    expect(formatLength(r.observedMm, 'mm', r.lcMm)).toBe('1.235');
  });

  it('S7: s = 0.5 exactly → PSR 0.5, CSR 0 (half-mm mark case)', () => {
    const r = readScrew(0.5, standard);
    expect(r.psrMm).toBe(0.5);
    expect(r.csr).toBe(0);
    expect(r.halfMmVisible).toBe(true);
    // The half-mm mark sits exactly at the thimble edge and counts as uncovered.
    expect(isMarkUncovered(0.5, 0.5)).toBe(true);
  });

  it('S8: increasing s → datum reading increases AND visible marks move DOWNWARD', () => {
    const p1 = 2.71;
    const p2 = 2.72;
    expect(readScrew(p2, standard).observedMm).toBeGreaterThan(readScrew(p1, standard).observedMm);
    const a = circularMarks(p1, standard);
    const b = circularMarks(p2, standard);
    let compared = 0;
    for (const m of a) {
      const n = b.find((x) => x.j === m.j);
      if (!n) continue;
      expect(n.yOverR).toBeGreaterThan(m.yOverR); // larger y = lower on screen
      compared++;
    }
    expect(compared).toBeGreaterThan(10);
  });

  it('numbers increase going UP the visible face', () => {
    const marks = circularMarks(1.0, standard).filter((m) => Math.abs(m.phiDeg) < 80);
    const sorted = [...marks].sort((x, y) => y.yOverR - x.yOverR); // bottom → top
    const js = sorted.map((m) => m.j);
    // Going up, division numbers increase (with wrap-around 49 → 0).
    for (let i = 1; i < js.length; i++) expect((js[i]! - js[i - 1]! + 50) % 50).toBe(1);
  });
});

describe('Screw gauge geometry (SPEC §6.2)', () => {
  it('thimble angle ↔ position', () => {
    expect(thimbleAngleDeg(0.5, standard)).toBe(360);
    expect(thimbleAngleDeg(0.25, standard)).toBe(180);
    expect(positionFromAngle(720, standard)).toBe(1);
    expect(wrapDeg(190)).toBe(-170);
    expect(wrapDeg(-180)).toBe(180);
    expect(wrapDeg(540)).toBe(180);
  });

  it('only front-face marks are returned; they foreshorten toward the edges', () => {
    const marks = circularMarks(1.234, standard);
    expect(marks.length).toBeGreaterThan(20);
    expect(marks.length).toBeLessThan(30);
    for (const m of marks) {
      expect(m.cos).toBeGreaterThan(VISIBLE_COS);
      expect(Math.abs(m.yOverR)).toBeLessThanOrEqual(1);
    }
    const labelled = marks.filter((m) => m.label !== null);
    expect(labelled.every((m) => m.j % 5 === 0 && m.size === 'major')).toBe(true);
    const fine100 = circularMarks(0.3, fine);
    expect(fine100.some((m) => m.size === 'mid')).toBe(true);
    expect(fine100.filter((m) => m.label).every((m) => m.j % 10 === 0)).toBe(true);
  });

  it('linear scale: mm above, half-mm below (pitch 0.5); mm only for pitch 1', () => {
    const std = linearMarks(standard);
    expect(std.filter((m) => m.side === 'upper')).toHaveLength(26);
    expect(std.filter((m) => m.side === 'lower')).toHaveLength(25);
    expect(std.filter((m) => m.label).map((m) => m.label)).toEqual(['0', '5', '10', '15', '20', '25']);
    expect(linearMarks(altA).every((m) => m.side === 'upper')).toBe(true);
  });

  it('marks beyond the thimble edge are hidden', () => {
    expect(isMarkUncovered(2.5, 2.734)).toBe(true);
    expect(isMarkUncovered(3.0, 2.734)).toBe(false);
  });
});
