/**
 * Screw gauge mechanics (SPEC §6.5) as a small pure state machine.
 *
 * Quantities (all mm unless stated):
 *   s      spindle gap — the real distance between anvil and spindle faces.
 *          Below `contactMm` the object is being squashed: compression = contactMm − s.
 *   slack  backlash play, 0 ≤ slack ≤ w, where w = backlashDeg/360 × pitch.
 *   p      thimble scale position = s + e + slack (what the scales show).
 *
 * Backlash is a "play" (dead-zone) element between the thimble and spindle:
 * turning to CLOSE takes the slack to 0 before the spindle moves; turning to
 * OPEN takes the slack to w before the spindle moves. A gauge that is always
 * closed onto the object therefore reads exactly; reversing direction costs a
 * dead zone of exactly `backlashDeg` (test M3).
 *
 * Over-tightening with the thimble: once the faces touch, further attempted
 * rotation squashes the object through a stiff spring,
 *   compression = min(maxCompression, k_c × extraAngle),
 * so the reading drops below the true size (test M2). There is no spring-back;
 * the student must back off.
 *
 * The ratchet drives the thimble normally but SLIPS at contact: the thimble
 * stops, the ratchet keeps turning, and a click event fires every 18° of slip
 * (test M1). No compression occurs.
 *
 * The lock freezes everything (test M4).
 */
import { EPS } from '../units';

/** Ratchet click spacing, degrees of slip. */
export const RATCHET_CLICK_DEG = 18;

export interface ScrewMechParams {
  pitch: number;
  /** Zero-error offset e, mm. */
  zeroOffsetMm: number;
  /** Backlash dead zone in degrees (0 = off). */
  backlashDeg: number;
  /** Largest gap the frame allows, mm. */
  maxGapMm: number;
  /** Size of whatever is between the faces at the current point (0 = nothing). */
  contactMm: number;
  /** Largest squash the object allows, mm (≈ 0.02 soft wire, 0.005 steel ball). */
  maxCompressionMm: number;
  /** Squash per degree of attempted over-rotation, mm/° (k_c). */
  compressionPerDeg: number;
}

export interface ScrewMechState {
  gapMm: number;
  slackMm: number;
  /** Cumulative ratchet-knob rotation, degrees (drives the knurl animation). */
  ratchetAngleDeg: number;
  /** Cumulative slip of the ratchet, degrees (click counter). */
  slipDeg: number;
  locked: boolean;
}

export type MechEvent = { type: 'contact' } | { type: 'ratchet-click'; count: number } | { type: 'limit' };

export interface MechResult {
  state: ScrewMechState;
  events: MechEvent[];
}

export function initialMechState(gapMm: number): ScrewMechState {
  return { gapMm, slackMm: 0, ratchetAngleDeg: 0, slipDeg: 0, locked: false };
}

export function backlashMm(p: ScrewMechParams): number {
  return (p.backlashDeg / 360) * p.pitch;
}

/** Thimble scale position p = s + e + slack. This is what the scales show. */
export function scalePositionOf(state: ScrewMechState, p: ScrewMechParams): number {
  return state.gapMm + p.zeroOffsetMm + state.slackMm;
}

/** Thimble angle in degrees, derived from the scale position. */
export function thimbleAngleOf(state: ScrewMechState, p: ScrewMechParams): number {
  return (scalePositionOf(state, p) / p.pitch) * 360;
}

/** How much the object is squashed right now, mm. */
export function compressionOf(state: ScrewMechState, p: ScrewMechParams): number {
  return Math.max(0, p.contactMm - state.gapMm);
}

function degToMm(deg: number, p: ScrewMechParams): number {
  return (deg / 360) * p.pitch;
}

type Driver = 'thimble' | 'ratchet';

function drive(state: ScrewMechState, p: ScrewMechParams, deltaDeg: number, driver: Driver): MechResult {
  if (state.locked || deltaDeg === 0) return { state, events: [] };
  const next: ScrewMechState = { ...state };
  const events: MechEvent[] = [];
  if (driver === 'ratchet') next.ratchetAngleDeg += deltaDeg;
  const w = backlashMm(p);
  let amount = degToMm(Math.abs(deltaDeg), p);

  if (deltaDeg > 0) {
    // OPENING: take up slack, then move the spindle away.
    const take = Math.min(amount, w - next.slackMm);
    next.slackMm += take;
    amount -= take;
    if (amount > 0) {
      const room = p.maxGapMm - next.gapMm;
      if (amount >= room - EPS) {
        next.gapMm = p.maxGapMm;
        if (amount > room + EPS) events.push({ type: 'limit' });
      } else {
        next.gapMm += amount;
      }
    }
    return { state: next, events };
  }

  // CLOSING: take up slack first.
  const take = Math.min(amount, next.slackMm);
  next.slackMm -= take;
  amount -= take;
  if (amount <= 0) return { state: next, events };

  // Free travel down to the contact surface.
  const wasFree = next.gapMm > p.contactMm + EPS;
  const free = Math.max(0, next.gapMm - p.contactMm);
  const move = Math.min(amount, free);
  next.gapMm -= move;
  amount -= move;
  if (wasFree && next.gapMm <= p.contactMm + EPS) {
    next.gapMm = p.contactMm;
    events.push({ type: 'contact' });
  }
  if (amount <= EPS) return { state: next, events };

  const extraDeg = (amount / p.pitch) * 360;
  if (driver === 'ratchet') {
    // Slip: the thimble stays put, the ratchet keeps turning and clicks.
    const before = Math.floor(next.slipDeg / RATCHET_CLICK_DEG + EPS);
    next.slipDeg += extraDeg;
    const after = Math.floor(next.slipDeg / RATCHET_CLICK_DEG + EPS);
    if (after > before) events.push({ type: 'ratchet-click', count: after - before });
    return { state: next, events };
  }

  // Thimble over-tightening: stiff spring, capped.
  const floor = p.contactMm - p.maxCompressionMm;
  next.gapMm = Math.max(floor, next.gapMm - p.compressionPerDeg * extraDeg);
  return { state: next, events };
}

/** Turn the thimble by deltaDeg (+ opens, − closes). */
export function rotateThimble(state: ScrewMechState, p: ScrewMechParams, deltaDeg: number): MechResult {
  return drive(state, p, deltaDeg, 'thimble');
}

/** Turn the ratchet knob by deltaDeg (+ opens, − closes). Slips at contact. */
export function rotateRatchet(state: ScrewMechState, p: ScrewMechParams, deltaDeg: number): MechResult {
  return drive(state, p, deltaDeg, 'ratchet');
}

export function setLocked(state: ScrewMechState, locked: boolean): ScrewMechState {
  return { ...state, locked };
}

/**
 * Jump the spindle to a target gap (the "open wide" convenience control).
 * The slack ends up on the side of the direction of travel.
 */
export function moveToGap(state: ScrewMechState, p: ScrewMechParams, targetGapMm: number): ScrewMechState {
  if (state.locked) return state;
  const target = Math.min(Math.max(targetGapMm, p.contactMm), p.maxGapMm);
  const slackMm = target > state.gapMm ? backlashMm(p) : target < state.gapMm ? 0 : state.slackMm;
  return { ...state, gapMm: target, slackMm };
}

/**
 * The object under the spindle changed (moved along the wire, rotated, or
 * swapped). If the new point is thicker than the current gap, the spindle is
 * pushed back to rest on it.
 */
export function applyContact(state: ScrewMechState, p: ScrewMechParams): ScrewMechState {
  if (state.gapMm >= p.contactMm - p.maxCompressionMm) return state;
  return { ...state, gapMm: p.contactMm };
}
