import { describe, expect, it } from 'vitest';
import {
  applyContact,
  backlashMm,
  compressionOf,
  initialMechState,
  moveToGap,
  RATCHET_CLICK_DEG,
  rotateRatchet,
  rotateThimble,
  scalePositionOf,
  setLocked,
  thimbleAngleOf,
  type MechEvent,
  type ScrewMechParams,
  type ScrewMechState,
} from '../src/core/screw/mechanics';
import { readScrew } from '../src/core/screw/reading';
import { SCREW_PRESETS } from '../src/core/screw/config';

const base: ScrewMechParams = {
  pitch: 0.5,
  zeroOffsetMm: 0,
  backlashDeg: 0,
  maxGapMm: 25,
  contactMm: 0.82,
  maxCompressionMm: 0.02,
  compressionPerDeg: 0.02 / 45,
};

function clicks(events: MechEvent[]): number {
  return events.reduce((s, e) => s + (e.type === 'ratchet-click' ? e.count : 0), 0);
}

describe('Screw gauge mechanics (SPEC §14.4)', () => {
  it('closing drives the spindle onto the object and reports contact once', () => {
    let s = initialMechState(1.0);
    const r = rotateThimble(s, base, -360); // −0.5 mm requested, only 0.18 mm free
    s = r.state;
    expect(r.events).toContainEqual({ type: 'contact' });
    expect(s.gapMm).toBeLessThan(0.82);
    // Already touching: no second contact event.
    expect(rotateThimble(s, base, -1).events).not.toContainEqual({ type: 'contact' });
  });

  it('M1: ratchet at contact leaves the gap unchanged and clicks every 18°', () => {
    let s = initialMechState(1.0);
    // Drive to contact with the ratchet: 0.18 mm = 129.6°.
    let r = rotateRatchet(s, base, -129.6);
    s = r.state;
    expect(s.gapMm).toBeCloseTo(0.82, 12);
    expect(r.events).toContainEqual({ type: 'contact' });
    const gapAtContact = s.gapMm;
    let total = 0;
    for (let i = 0; i < 90; i++) {
      r = rotateRatchet(s, base, -2); // 180° of slip in 2° steps
      s = r.state;
      total += clicks(r.events);
      expect(s.gapMm).toBe(gapAtContact);
    }
    expect(total).toBe(180 / RATCHET_CLICK_DEG);
    expect(compressionOf(s, base)).toBe(0);
    expect(s.ratchetAngleDeg).toBeCloseTo(-129.6 - 180, 9);
    // One big turn past contact also emits the right number of clicks.
    const big = rotateRatchet(s, base, -54);
    expect(clicks(big.events)).toBe(3);
  });

  it('M2: over-tightening with the thimble lowers the reading monotonically, capped', () => {
    const c = SCREW_PRESETS.standard;
    let s = initialMechState(0.82);
    let prev = readScrew(scalePositionOf(s, base), c).observedMm;
    let prevPos = scalePositionOf(s, base);
    for (let i = 0; i < 40; i++) {
      s = rotateThimble(s, base, -5).state;
      const pos = scalePositionOf(s, base);
      expect(pos).toBeLessThanOrEqual(prevPos + 1e-15);
      const reading = readScrew(pos, c).observedMm;
      expect(reading).toBeLessThanOrEqual(prev);
      prev = reading;
      prevPos = pos;
    }
    expect(compressionOf(s, base)).toBeCloseTo(base.maxCompressionMm, 12);
    expect(prev).toBe(0.8); // 0.82 − 0.02
    // Formula check: compression = min(max, k_c × extraAngle).
    const one = rotateThimble(initialMechState(0.82), base, -10).state;
    expect(compressionOf(one, base)).toBeCloseTo(base.compressionPerDeg * 10, 12);
    // No spring-back: nothing changes until the student turns back.
    const back = rotateThimble(s, base, 7.2).state; // +0.01 mm
    expect(back.gapMm).toBeCloseTo(0.81, 12);
  });

  it('M3: reversing direction gives a dead zone of exactly b degrees; same direction gives none', () => {
    const b = 9;
    const p: ScrewMechParams = { ...base, backlashDeg: b, contactMm: 0 };
    let s: ScrewMechState = initialMechState(2.0);
    // Opening from rest (slack 0): first b° only take up the play.
    s = rotateThimble(s, p, 30).state;
    expect(s.slackMm).toBeCloseTo(backlashMm(p), 12);
    expect(s.gapMm).toBeCloseTo(2.0 + ((30 - b) / 360) * 0.5, 12);
    // Continue opening: no dead zone, spindle moves 1:1.
    const before = s.gapMm;
    s = rotateThimble(s, p, 1).state;
    expect(s.gapMm - before).toBeCloseTo(0.5 / 360, 12);
    // Reverse: exactly b° of thimble rotation with no spindle motion.
    const atReverse = s.gapMm;
    for (let i = 0; i < b * 10; i++) {
      s = rotateThimble(s, p, -0.1).state;
      expect(s.gapMm).toBeCloseTo(atReverse, 12);
    }
    s = rotateThimble(s, p, -0.1).state;
    expect(atReverse - s.gapMm).toBeCloseTo((0.1 / 360) * 0.5, 9);
    // While the slack was taken up the THIMBLE (and so the reading) did move.
    expect(thimbleAngleOf(s, p)).toBeLessThan(thimbleAngleOf({ ...s, gapMm: atReverse, slackMm: backlashMm(p) }, p));
  });

  it('backlash makes an opening approach read high by up to b worth of travel', () => {
    const p: ScrewMechParams = { ...base, backlashDeg: 12, contactMm: 0 };
    let s = rotateThimble(initialMechState(1.0), p, 180).state;
    const err = scalePositionOf(s, p) - (s.gapMm + p.zeroOffsetMm);
    expect(err).toBeCloseTo((12 / 360) * 0.5, 12);
    s = rotateThimble(s, p, -180).state; // approach by closing: exact again
    expect(s.slackMm).toBe(0);
  });

  it('M4: the lock prevents any change in gap', () => {
    let s = setLocked(initialMechState(3.21), true);
    for (const d of [-720, -10, 5, 400]) {
      const r1 = rotateThimble(s, base, d);
      const r2 = rotateRatchet(s, base, d);
      expect(r1.state).toBe(s);
      expect(r2.state).toBe(s);
      expect(r1.events).toEqual([]);
    }
    expect(moveToGap(s, base, 10)).toBe(s);
    s = setLocked(s, false);
    expect(rotateThimble(s, base, 360).state.gapMm).toBeCloseTo(3.71, 12);
  });

  it('frame limit: the spindle stops at the maximum gap', () => {
    const r = rotateThimble(initialMechState(24.9), base, 360);
    expect(r.state.gapMm).toBe(25);
    expect(r.events).toContainEqual({ type: 'limit' });
    expect(rotateThimble(initialMechState(24.5), base, 360).events).toEqual([]);
  });

  it('a zero turn and zero-length moves change nothing', () => {
    const s = initialMechState(1);
    expect(rotateThimble(s, base, 0).state).toBe(s);
  });

  it('opening/closing with the ratchet away from contact behaves like the thimble', () => {
    const s = initialMechState(5);
    expect(rotateRatchet(s, base, 720).state.gapMm).toBeCloseTo(6, 12);
    expect(rotateRatchet(s, base, -720).state.gapMm).toBeCloseTo(4, 12);
  });

  it('moveToGap and applyContact', () => {
    const p: ScrewMechParams = { ...base, backlashDeg: 6 };
    const s = initialMechState(1);
    const opened = moveToGap(s, p, 10);
    expect(opened.gapMm).toBe(10);
    expect(opened.slackMm).toBeCloseTo(backlashMm(p), 12);
    const closed = moveToGap(opened, p, 0.1);
    expect(closed.gapMm).toBe(0.82); // cannot close through the object
    expect(closed.slackMm).toBe(0);
    expect(moveToGap(closed, p, 0.82).slackMm).toBe(0);
    // Moving along the wire to a thicker point pushes the spindle back.
    const thick: ScrewMechParams = { ...p, contactMm: 0.9 };
    expect(applyContact(closed, thick).gapMm).toBe(0.9);
    expect(applyContact(opened, thick)).toBe(opened);
  });
});
