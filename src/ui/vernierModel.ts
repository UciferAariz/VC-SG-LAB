/**
 * Vernier page state and derived values. Every number shown in the UI comes
 * from here, and everything here comes from core/ (SPEC §18).
 */
import { createObject, DEFAULT_PLACEMENT, getDimension, trueSize, type MeasurableObject, type Placement, type VernierObjectKind, VERNIER_OBJECT_KINDS } from '../core/objects';
import { Rng } from '../core/rng';
import type { LengthUnit } from '../core/units';
import { leastCount, maxGapMm, VERNIER_PRESETS, type VernierConfig, type VernierPresetId } from '../core/vernier/config';
import { clampGap, vernierZeroPosition, type VernierContact } from '../core/vernier/geometry';
import { readVernier, type VernierReading } from '../core/vernier/reading';
import { generateVernierZeroOffset, vernierZeroError } from '../core/vernier/zeroError';
import { loadPrefs } from './prefs';
import { correctedMm, type ZeroErrorInfo, type ZeroErrorSettings } from '../core/zeroCommon';

export type Magnification = 4 | 6 | 8;
import type { Theme } from './prefs';
export type { Theme };

export interface VernierState {
  presetId: VernierPresetId;
  unit: LengthUnit;
  zeroSettings: ZeroErrorSettings;
  seed: number;
  /** The instrument's hidden zero offset e (mm), derived from seed + settings. */
  zeroOffsetMm: number;
  gapMm: number;
  locked: boolean;
  objectKind: VernierObjectKind | null;
  dimId: string;
  placement: Placement;
  /** Counts repositions, so each reposition draws fresh, reproducible numbers. */
  placementCount: number;
  loupeOn: boolean;
  loupeMag: Magnification;
  loupePinned: boolean;
  /** Follow mode: focus = vernier zero + this offset (mm). Pinned: absolute world x. */
  loupeOffsetMm: number;
  loupePinnedX: number;
  aids: boolean;
  showTrue: boolean;
  fine: boolean;
  theme: Theme;
}

export interface VernierDerived {
  config: VernierConfig;
  lcMm: number;
  /** Vernier zero position x = gap + e. */
  xMm: number;
  reading: VernierReading;
  ze: ZeroErrorInfo;
  correctedMm: number;
  object: MeasurableObject | null;
  objectSizeMm: number | null;
  contact: VernierContact | null;
  touching: boolean;
  maxGapMm: number;
}

/** Each seed defines one instance of every object, independent of draw order. */
const objectCache = new Map<string, MeasurableObject>();
export function objectFor(seed: number, kind: VernierObjectKind): MeasurableObject {
  const key = `${seed}:${kind}`;
  let o = objectCache.get(key);
  if (!o) {
    o = createObject(kind, new Rng(seed).fork(`vernier-object:${kind}`));
    objectCache.set(key, o);
  }
  return o;
}

export function zeroOffsetFor(seed: number, settings: ZeroErrorSettings, config: VernierConfig): number {
  const label = `vernier-zero:${config.id}:${settings.mode}:${settings.custom?.divisions ?? ''}:${settings.custom?.sign ?? ''}`;
  return generateVernierZeroOffset(new Rng(seed).fork(label), settings, config);
}

export function contactFor(obj: MeasurableObject | null, dimId: string): VernierContact | null {
  if (!obj) return null;
  const jaw = getDimension(obj, dimId).jaw;
  return jaw === 'outer' || jaw === 'inner' || jaw === 'depth' ? jaw : null;
}

export function derive(s: VernierState): VernierDerived {
  const config = VERNIER_PRESETS[s.presetId];
  const lcMm = leastCount(config);
  const xMm = vernierZeroPosition(s.gapMm, s.zeroOffsetMm);
  const reading = readVernier(xMm, config);
  const ze = vernierZeroError(s.zeroOffsetMm, config);
  const object = s.objectKind ? objectFor(s.seed, s.objectKind) : null;
  const objectSizeMm = object ? trueSize(object, s.dimId, s.placement) : null;
  const contact = contactFor(object, s.dimId);
  const touching = objectSizeMm !== null && Math.abs(s.gapMm - objectSizeMm) < 1e-6;
  return {
    config,
    lcMm,
    xMm,
    reading,
    ze,
    correctedMm: correctedMm(reading.counts, ze.counts, lcMm),
    object,
    objectSizeMm,
    contact,
    touching,
    maxGapMm: maxGapMm(config),
  };
}

/** Apply the jaw/rod collision rules from core to a requested gap. */
export function constrainGap(s: VernierState, requested: number): number {
  const config = VERNIER_PRESETS[s.presetId];
  const object = s.objectKind ? objectFor(s.seed, s.objectKind) : null;
  const size = object ? trueSize(object, s.dimId, s.placement) : null;
  return clampGap(requested, config, contactFor(object, s.dimId), size);
}

/**
 * A comfortable starting gap when an object is chosen: outer jaws a little
 * open beyond the object, inner jaws / depth rod a little short of the wall.
 */
export function startingGap(s: VernierState): number {
  const config = VERNIER_PRESETS[s.presetId];
  const object = s.objectKind ? objectFor(s.seed, s.objectKind) : null;
  if (!object) return s.gapMm;
  const size = trueSize(object, s.dimId, s.placement);
  const contact = contactFor(object, s.dimId);
  const target = contact === 'outer' ? size + 4 : Math.max(0, size - 4);
  return clampGap(target, config, contact, size);
}

/** Fresh reproducible placement for the n-th reposition. */
export function placementFor(seed: number, count: number, prev: Placement): Placement {
  const rng = new Rng(seed).fork(`vernier-place:${count}`);
  return { angleDeg: rng.range(0, 180), along: rng.range(0.1, 0.9), perpendicular: prev.perpendicular };
}

export function defaultDimension(kind: VernierObjectKind): string {
  return createObject(kind, new Rng(1)).dimensions[0]!.id;
}

export const OBJECT_KINDS = VERNIER_OBJECT_KINDS;

export function initialState(seed: number): VernierState {
  const config = VERNIER_PRESETS.standard;
  const zeroSettings: ZeroErrorSettings = { mode: 'none' };
  return {
    presetId: config.id,
    unit: 'cm',
    zeroSettings,
    seed,
    zeroOffsetMm: zeroOffsetFor(seed, zeroSettings, config),
    gapMm: 23.47,
    locked: false,
    objectKind: null,
    dimId: 'diameter',
    placement: DEFAULT_PLACEMENT,
    placementCount: 0,
    loupeOn: loadPrefs().loupe,
    loupeMag: 6,
    loupePinned: false,
    loupeOffsetMm: 4.5,
    loupePinnedX: 25,
    aids: true,
    showTrue: false,
    fine: false,
    theme: loadPrefs().theme,
  };
}
