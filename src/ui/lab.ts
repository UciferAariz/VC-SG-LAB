/**
 * The contract between an instrument page and the modes (Practice,
 * Experiment, Guided, Presentation). Modes never touch the instrument's state
 * directly: they read a snapshot (built from core/ results) and ask the page
 * to do things through this adapter, so the same mode code serves both the
 * vernier and the screw gauge.
 */
import type { DerivedKind } from '../core/errors';
import type { LengthUnit } from '../core/units';
import type { ZeroErrorInfo, ZeroErrorSettings } from '../core/zeroCommon';

export type InstrumentId = 'vernier' | 'screw';

export interface LabSnapshot {
  instrument: InstrumentId;
  unit: LengthUnit;
  lcMm: number;
  /** Divisions on the vernier / circular scale. */
  N: number;
  /** Screw gauge only. */
  pitchMm?: number;
  /** Vernier only. */
  msdMm?: number;
  gamma?: number;
  configKey: string;
  configLabel: string;
  /** MSR (vernier) or PSR (screw), mm. */
  msrMm: number;
  /** VSR (vernier) or CSR (screw). */
  vsr: number;
  observedMm: number;
  ze: ZeroErrorInfo;
  correctedMm: number;
  /** Hidden true gap / size, mm. */
  trueMm: number;
  objectKind: string | null;
  dimId: string;
  /** Jaws / faces resting on the object, or on each other with nothing between. */
  touching: boolean;
  /** Nothing between the jaws / faces and they are touching. */
  closed: boolean;
  /** Changes every time the object is repositioned. */
  placementKey: string;
  /** Screw-gauge wire: measuring direction. */
  direction: 'parallel' | 'perp' | null;
  halfMmVisible: boolean;
  /** Screw gauge: how much the object is squashed (over-tightening), mm. */
  compressionMm: number;
  locked: boolean;
}

export interface DimensionOption {
  id: string;
  label: string;
  symbol: string;
}

export interface ObjectOption {
  kind: string;
  label: string;
  dims: DimensionOption[];
  /** Derived quantity this object supports (Experiment step 5), if any. */
  derived: DerivedKind | null;
  /** Experiment aim / apparatus wording. */
  aimNoun: string;
}

/** Page-level flags a mode may set. Explore uses the defaults. */
export interface ModeFlags {
  hideReadout: boolean;
  /** Highlight aids may be switched on (OFF in Practice, SPEC §5.7). */
  aidsAllowed: boolean;
  /** "Open" may go to a gap near the object's size (it would reveal values). */
  revealingOpen: boolean;
  /** Describe the gap without giving the answer (aria-valuetext). */
  hideAriaReading: boolean;
}

export const EXPLORE_FLAGS: ModeFlags = { hideReadout: false, aidsAllowed: true, revealingOpen: true, hideAriaReading: false };

export interface LabAdapter {
  instrument: InstrumentId;
  title: string;
  objects: ObjectOption[];
  snapshot(): LabSnapshot;
  /** Called after every state change (at most once per frame). */
  subscribe(fn: () => void): () => void;
  setFlags(flags: Partial<ModeFlags>): void;
  setObject(kind: string | null, dimId?: string): void;
  setZeroSettings(z: ZeroErrorSettings): void;
  zeroSettings(): ZeroErrorSettings;
  /** New random placement of the current object ("Rotate / reposition"). */
  reposition(): void;
  /** Screw-gauge wire: measure the perpendicular diameter at the same point. */
  rotate90?(): void;
  /** Practice "close" hint: show the neighbouring lines with their misalignments. */
  showCandidates(on: boolean): void;
  /** Worked solution: highlight the lines used for the reading, even if aids are off. */
  showWorked(on: boolean): void;
  setAids(on: boolean): void;
  setLocked(on: boolean): void;
  setLoupe(on: boolean): void;
  view(kind: 'fit' | 'scale' | 'default'): void;
  /** Move the jaws / spindle to a gap, animated unless reduced motion. */
  animateGap(gapMm: number, ms?: number): Promise<void>;
  /** Close onto the object (vernier: to contact; screw: with the ratchet until it slips). */
  closeOnObject(): Promise<void>;
  setBold(on: boolean): void;
  flash(text: string): void;
  seed(): number;
  /** Instrument-specific state for the guided activities. */
  guided: GuidedHooks;
}

export interface GuidedHooks {
  /** Vernier: highlight vernier marks 0…k and the main-scale length they span (null clears). */
  setSpan?(k: number | null): void;
  /** Vernier: nearest vernier mark to a stage pointer position, or null. */
  vernierIndexAt?(clientX: number, clientY: number): number | null;
  /** Vernier: set the slider so the vernier zero sits on a main-scale mark. */
  alignZero?(): void;
  /** Screw: mark the current thimble position as the start of a turn (null clears). */
  markStart?(on: boolean): void;
  /** Screw: thimble turns and edge travel since the start mark. */
  sinceStart?(): { turns: number; edgeMm: number } | null;
}
