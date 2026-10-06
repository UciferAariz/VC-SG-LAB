/**
 * Screw gauge page state and derived values. Every number shown in the UI
 * comes from here, and everything here comes from core/ (SPEC §18): the
 * mechanics state machine moves the spindle, readScrew reads the scales.
 */
import { createObject, DEFAULT_PLACEMENT, moveAlong, rotate90, trueSize, SCREW_OBJECT_KINDS, type MeasurableObject, type Placement, type ScrewObjectKind } from '../core/objects';
import { Rng } from '../core/rng';
import type { LengthUnit } from '../core/units';
import { SCREW_PRESETS, SCREW_RANGE_MM, screwLeastCount, type ScrewConfig, type ScrewPresetId } from '../core/screw/config';
import {
  applyContact,
  backlashMm,
  compressionOf,
  initialMechState,
  moveToGap,
  rotateRatchet,
  rotateThimble,
  scalePositionOf,
  setLocked,
  thimbleAngleOf,
  type MechEvent,
  type ScrewMechParams,
  type ScrewMechState,
} from '../core/screw/mechanics';
import { readScrew, type ScrewReading } from '../core/screw/reading';
import { generateScrewZeroOffset, screwZeroError } from '../core/screw/zeroError';
import { correctedMm, type ZeroErrorInfo, type ZeroErrorSettings } from '../core/zeroCommon';
import { loadPrefs, type Theme } from './prefs';
import type { Magnification } from './vernierModel';

export interface ScrewState {
  presetId: ScrewPresetId;
  unit: LengthUnit;
  zeroSettings: ZeroErrorSettings;
  seed: number;
  /** Hidden zero offset e (mm), derived from seed + settings. */
  zeroOffsetMm: number;
  mech: ScrewMechState;
  backlashOn: boolean;
  objectKind: ScrewObjectKind | null;
  placement: Placement;
  placementCount: number;
  loupeOn: boolean;
  loupeMag: Magnification;
  loupePinned: boolean;
  /** Follow mode: focus = thimble edge + this offset (mm). */
  loupeOffsetMm: number;
  loupePinnedX: number;
  aids: boolean;
  showTrue: boolean;
  /** Readout: extra line with the zero-error working (Observed − ZE = Corrected). */
  showZeWorking: boolean;
  fine: boolean;
  theme: Theme;
}

export interface ScrewDerived {
  config: ScrewConfig;
  lcMm: number;
  params: ScrewMechParams;
  /** Scale position p = s + e + slack. */
  pMm: number;
  thimbleDeg: number;
  /** Visual ratchet rotation: it turns with the thimble, plus any slip. */
  ratchetDeg: number;
  reading: ScrewReading;
  ze: ZeroErrorInfo;
  correctedMm: number;
  object: MeasurableObject | null;
  objectSizeMm: number | null;
  compressionMm: number;
  /** Faces resting on the object (or on each other with nothing between). */
  touching: boolean;
}

const objectCache = new Map<string, MeasurableObject>();
export function objectFor(seed: number, kind: ScrewObjectKind): MeasurableObject {
  const key = `${seed}:${kind}`;
  let o = objectCache.get(key);
  if (!o) {
    o = createObject(kind, new Rng(seed).fork(`screw-object:${kind}`));
    objectCache.set(key, o);
  }
  return o;
}

export function zeroOffsetFor(seed: number, settings: ZeroErrorSettings, config: ScrewConfig): number {
  const label = `screw-zero:${config.id}:${settings.mode}:${settings.custom?.divisions ?? ''}:${settings.custom?.sign ?? ''}`;
  return generateScrewZeroOffset(new Rng(seed).fork(label), settings, config);
}

/** Backlash dead zone for this session: 3°–12° (SPEC §6.5), reproducible from the seed. */
export function backlashDegFor(seed: number): number {
  return new Rng(seed).fork('screw-backlash').range(3, 12);
}

export function objectSize(s: ScrewState): number | null {
  if (!s.objectKind) return null;
  const obj = objectFor(s.seed, s.objectKind);
  return trueSize(obj, obj.dimensions[0]!.id, s.placement);
}

export function paramsFor(s: ScrewState): ScrewMechParams {
  const config = SCREW_PRESETS[s.presetId];
  const obj = s.objectKind ? objectFor(s.seed, s.objectKind) : null;
  const backlashDeg = s.backlashOn ? backlashDegFor(s.seed) : 0;
  const w = (backlashDeg / 360) * config.pitch;
  return {
    pitch: config.pitch,
    zeroOffsetMm: s.zeroOffsetMm,
    backlashDeg,
    // The thimble edge must stay on the 0–25 mm linear scale.
    maxGapMm: SCREW_RANGE_MM - Math.max(0, s.zeroOffsetMm) - w,
    contactMm: objectSize(s) ?? 0,
    maxCompressionMm: obj?.maxCompressionMm ?? 0,
    compressionPerDeg: obj?.compressionPerDeg ?? 0,
  };
}

export function derive(s: ScrewState): ScrewDerived {
  const config = SCREW_PRESETS[s.presetId];
  const params = paramsFor(s);
  const pMm = scalePositionOf(s.mech, params);
  const reading = readScrew(pMm, config);
  const ze = screwZeroError(s.zeroOffsetMm, config);
  const lcMm = screwLeastCount(config);
  const object = s.objectKind ? objectFor(s.seed, s.objectKind) : null;
  const thimbleDeg = thimbleAngleOf(s.mech, params);
  return {
    config,
    lcMm,
    params,
    pMm,
    thimbleDeg,
    ratchetDeg: thimbleDeg + s.mech.slipDeg,
    reading,
    ze,
    correctedMm: correctedMm(reading.counts, ze.counts, lcMm),
    object,
    objectSizeMm: objectSize(s),
    compressionMm: compressionOf(s.mech, params),
    touching: s.mech.gapMm <= params.contactMm + 1e-9,
  };
}

export interface Turn {
  mech: ScrewMechState;
  events: MechEvent[];
}

/** Turn the thimble by deltaDeg (+ opens, − closes). */
export function turnThimble(s: ScrewState, deltaDeg: number): Turn {
  const r = rotateThimble(s.mech, paramsFor(s), deltaDeg);
  return { mech: r.state, events: r.events };
}

/** Turn the ratchet by deltaDeg (+ opens, − closes); slips at contact. */
export function turnRatchet(s: ScrewState, deltaDeg: number): Turn {
  const r = rotateRatchet(s.mech, paramsFor(s), deltaDeg);
  return { mech: r.state, events: r.events };
}

export function withGap(s: ScrewState, gapMm: number): ScrewMechState {
  return moveToGap(s.mech, paramsFor(s), gapMm);
}

export function lockMech(s: ScrewState, locked: boolean): ScrewMechState {
  return setLocked(s.mech, locked);
}

/** After the object or its placement changes, the spindle may be pushed back. */
export function settle(s: ScrewState): ScrewMechState {
  return applyContact(s.mech, paramsFor(s));
}

/** Comfortable gap for a newly chosen object: a little open beyond it. */
export function startingGap(s: ScrewState): number {
  const size = objectSize(s);
  return size === null ? 2 : size + 0.6;
}

/** "Open" control: a fixed wide gap that cannot reveal the object's size. */
export const OPEN_GAP_MM = 15;

export function placementFor(seed: number, count: number, prev: Placement, how: 'along' | 'rotate' | 'random'): Placement {
  const rng = new Rng(seed).fork(`screw-place:${count}`);
  if (how === 'rotate') return rotate90(prev);
  if (how === 'along') return moveAlong(rng, prev);
  return { angleDeg: rng.range(0, 180), along: rng.range(0.1, 0.9), perpendicular: prev.perpendicular };
}

export const OBJECT_KINDS = SCREW_OBJECT_KINDS;

export function backlashWidthMm(s: ScrewState): number {
  return backlashMm(paramsFor(s));
}

export function initialState(seed: number): ScrewState {
  const config = SCREW_PRESETS.standard;
  const zeroSettings: ZeroErrorSettings = { mode: 'none' };
  return {
    presetId: config.id,
    unit: 'mm',
    zeroSettings,
    seed,
    zeroOffsetMm: zeroOffsetFor(seed, zeroSettings, config),
    mech: initialMechState(2.734),
    backlashOn: false,
    objectKind: null,
    placement: DEFAULT_PLACEMENT,
    placementCount: 0,
    loupeOn: loadPrefs().loupe,
    loupeMag: 4,
    loupePinned: false,
    loupeOffsetMm: 1.2,
    loupePinnedX: 50,
    aids: true,
    showTrue: false,
    showZeWorking: false,
    fine: false,
    theme: loadPrefs().theme,
  };
}
