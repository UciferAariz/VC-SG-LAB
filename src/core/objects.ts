/**
 * Measurable objects (SPEC §5.6, §6.6).
 *
 * Each object has nominal sizes drawn from the seeded RNG plus a small,
 * deterministic imperfection, so its TRUE size depends on where and how it is
 * held. Repositioning changes the true value within its imperfection band —
 * that is what makes repeated readings genuinely differ for error analysis.
 *
 * Imperfection model for every dimension:
 *   size(angle, along) = nominal + A·cos(2(angle − φ)) + T·(2·along − 1)
 *     A — ovality / out-of-roundness amplitude (depends on orientation)
 *     T — taper / non-parallel faces (depends on the measuring point)
 */
import type { Rng } from './rng';

export type InstrumentKind = 'vernier' | 'screw';
export type JawKind = 'outer' | 'inner' | 'depth' | 'spindle';

export type VernierObjectKind = 'bob' | 'cylinder' | 'beaker' | 'block' | 'marble' | 'battery' | 'tube' | 'matchbox';
export type ScrewObjectKind = 'wire' | 'sheet' | 'slide' | 'ball' | 'paper' | 'hair' | 'blade' | 'needle' | 'lead' | 'card';
export type ObjectKind = VernierObjectKind | ScrewObjectKind;

export const VERNIER_OBJECT_KINDS: readonly VernierObjectKind[] = ['bob', 'cylinder', 'beaker', 'block', 'marble', 'battery', 'tube', 'matchbox'];
export const SCREW_OBJECT_KINDS: readonly ScrewObjectKind[] = ['wire', 'sheet', 'slide', 'ball', 'paper', 'hair', 'blade', 'needle', 'lead', 'card'];

export interface Imperfection {
  /** Orientation-dependent amplitude, mm. */
  amp: number;
  /** Phase of the orientation term, degrees. */
  phaseDeg: number;
  /** Position-dependent (taper) half-range, mm. */
  taper: number;
}

export interface Dimension {
  id: string;
  label: string;
  /** Symbol used in tables and formulae (d, L, D, h …). */
  symbol: string;
  jaw: JawKind;
  nominalMm: number;
  imperfection: Imperfection;
}

export interface MeasurableObject {
  kind: ObjectKind;
  label: string;
  instrument: InstrumentKind;
  dimensions: Dimension[];
  /** Screw gauge only: largest squash under over-tightening, mm. */
  maxCompressionMm: number;
  /** Screw gauge only: squash per degree of over-rotation, mm/°. */
  compressionPerDeg: number;
  /** Paper stack only: number of sheets. */
  sheets?: number;
}

/** Where and how the object is held between the jaws. */
export interface Placement {
  /** Orientation about the measuring axis, degrees. */
  angleDeg: number;
  /** Measuring point along the object, 0 … 1. */
  along: number;
  /** Wire only: measuring the perpendicular (⊥) diameter. */
  perpendicular: boolean;
}

export const DEFAULT_PLACEMENT: Placement = { angleDeg: 0, along: 0.5, perpendicular: false };

/** Over-tightening reaches its cap after this much attempted extra rotation. */
const COMPRESSION_FULL_DEG = 45;

function imp(rng: Rng, amp: [number, number], taper: number): Imperfection {
  return {
    amp: rng.range(amp[0], amp[1]),
    phaseDeg: rng.range(0, 180),
    taper: rng.range(-taper, taper),
  };
}

function dim(id: string, label: string, symbol: string, jaw: JawKind, nominalMm: number, imperfection: Imperfection): Dimension {
  return { id, label, symbol, jaw, nominalMm, imperfection };
}

function screwSoftness(maxCompressionMm: number) {
  return { maxCompressionMm, compressionPerDeg: maxCompressionMm / COMPRESSION_FULL_DEG };
}

const RIGID = { maxCompressionMm: 0, compressionPerDeg: 0 };

/** Build an object with its true sizes drawn from `rng`. */
export function createObject(kind: ObjectKind, rng: Rng): MeasurableObject {
  switch (kind) {
    case 'bob':
      return {
        kind, label: 'Pendulum bob', instrument: 'vernier', ...RIGID,
        dimensions: [dim('diameter', 'External diameter', 'd', 'outer', rng.range(15, 25), imp(rng, [0.05, 0.15], 0))],
      };
    case 'cylinder':
      return {
        kind, label: 'Solid cylinder', instrument: 'vernier', ...RIGID,
        dimensions: [
          dim('diameter', 'Diameter', 'd', 'outer', rng.range(12, 25), imp(rng, [0, 0.02], 0.05)),
          dim('length', 'Length', 'L', 'outer', rng.range(25, 60), imp(rng, [0, 0], 0.03)),
        ],
      };
    case 'beaker':
      return {
        kind, label: 'Beaker / calorimeter', instrument: 'vernier', ...RIGID,
        dimensions: [
          dim('internalDiameter', 'Internal diameter', 'D', 'inner', rng.range(40, 60), imp(rng, [0.03, 0.1], 0)),
          dim('depth', 'Depth', 'h', 'depth', rng.range(50, 80), imp(rng, [0, 0], 0.05)),
        ],
      };
    case 'block':
      return {
        kind, label: 'Rectangular block', instrument: 'vernier', ...RIGID,
        dimensions: [
          dim('length', 'Length', 'l', 'outer', rng.range(10, 60), imp(rng, [0, 0], 0.05)),
          dim('breadth', 'Breadth', 'b', 'outer', rng.range(10, 60), imp(rng, [0, 0], 0.05)),
          dim('height', 'Height', 'h', 'outer', rng.range(10, 60), imp(rng, [0, 0], 0.05)),
        ],
      };
    case 'marble':
      // Hand-made glass marbles are noticeably out of round.
      return {
        kind, label: 'Glass marble', instrument: 'vernier', ...RIGID,
        dimensions: [dim('diameter', 'Diameter', 'd', 'outer', rng.range(14, 17), imp(rng, [0.03, 0.08], 0))],
      };
    case 'battery':
      // AA cell (IEC R6 / LR6): 13.5–14.5 mm × 49.2–50.5 mm, including the + button.
      return {
        kind, label: 'AA cell (battery)', instrument: 'vernier', ...RIGID,
        dimensions: [
          dim('diameter', 'Diameter', 'd', 'outer', rng.range(13.9, 14.4), imp(rng, [0, 0.02], 0.02)),
          dim('length', 'Length', 'L', 'outer', rng.range(49.8, 50.4), imp(rng, [0, 0.02], 0)),
        ],
      };
    case 'tube': {
      // Hollow brass tube (NCERT: internal and external diameter of a hollow cylinder).
      const D = rng.range(18, 26);
      const wall = rng.range(1.2, 2.5);
      return {
        kind, label: 'Hollow brass tube', instrument: 'vernier', ...RIGID,
        dimensions: [
          dim('externalDiameter', 'External diameter', 'D', 'outer', D, imp(rng, [0.01, 0.04], 0.03)),
          dim('internalDiameter', 'Internal diameter', 'd', 'inner', D - 2 * wall, imp(rng, [0.01, 0.05], 0.03)),
          dim('length', 'Length', 'L', 'outer', rng.range(40, 70), imp(rng, [0, 0], 0.04)),
        ],
      };
    }
    case 'matchbox':
      // Cardboard: the faces bow a little, so it varies more than a machined block.
      return {
        kind, label: 'Matchbox', instrument: 'vernier', ...RIGID,
        dimensions: [
          dim('length', 'Length', 'l', 'outer', rng.range(47, 53), imp(rng, [0, 0], 0.1)),
          dim('breadth', 'Breadth', 'b', 'outer', rng.range(34, 38), imp(rng, [0, 0], 0.1)),
          dim('height', 'Height', 'h', 'outer', rng.range(14, 17), imp(rng, [0, 0], 0.08)),
        ],
      };
    case 'wire':
      return {
        kind, label: 'Copper wire', instrument: 'screw', ...screwSoftness(0.02),
        dimensions: [dim('diameter', 'Diameter', 'd', 'spindle', rng.range(0.3, 1.5), imp(rng, [0.005, 0.015], 0.01))],
      };
    case 'sheet':
      return {
        kind, label: 'Metal sheet / coin', instrument: 'screw', ...screwSoftness(0.008),
        dimensions: [dim('thickness', 'Thickness', 't', 'spindle', rng.range(0.5, 2), imp(rng, [0.002, 0.004], 0.006))],
      };
    case 'slide':
      return {
        kind, label: 'Glass slide', instrument: 'screw', ...screwSoftness(0.002),
        dimensions: [dim('thickness', 'Thickness', 't', 'spindle', rng.range(0.9, 1.3), imp(rng, [0.001, 0.002], 0.003))],
      };
    case 'ball':
      return {
        kind, label: 'Steel ball bearing', instrument: 'screw', ...screwSoftness(0.005),
        dimensions: [dim('diameter', 'Diameter', 'd', 'spindle', rng.range(3, 8), imp(rng, [0.0005, 0.002], 0))],
      };
    case 'hair':
      // Human hair is elliptical in section, so the orientation term is large.
      return {
        kind, label: 'Human hair', instrument: 'screw', ...screwSoftness(0.006),
        dimensions: [dim('diameter', 'Diameter', 'd', 'spindle', rng.range(0.05, 0.11), imp(rng, [0.003, 0.01], 0.004))],
      };
    case 'blade':
      // Double-edge razor blade, about 0.1 mm of hardened steel.
      return {
        kind, label: 'Razor blade', instrument: 'screw', ...screwSoftness(0.001),
        dimensions: [dim('thickness', 'Thickness', 't', 'spindle', rng.range(0.09, 0.11), imp(rng, [0, 0.001], 0.002))],
      };
    case 'needle':
      return {
        kind, label: 'Sewing needle', instrument: 'screw', ...screwSoftness(0.001),
        dimensions: [dim('diameter', 'Diameter', 'd', 'spindle', rng.range(0.6, 0.9), imp(rng, [0.001, 0.003], 0.004))],
      };
    case 'lead': {
      // Mechanical-pencil refill: nominal 0.5 / 0.7 / 0.9 mm leads are made slightly oversize.
      const nominal = rng.pick([0.57, 0.7, 0.9]);
      return {
        kind, label: 'Pencil lead (refill)', instrument: 'screw', ...screwSoftness(0.004),
        dimensions: [dim('diameter', 'Diameter', 'd', 'spindle', nominal + rng.range(-0.02, 0.02), imp(rng, [0.001, 0.004], 0.003))],
      };
    }
    case 'card':
      // ISO/IEC 7810 ID-1 card: 0.76 mm ± 0.08 mm of PVC.
      return {
        kind, label: 'Plastic ID card', instrument: 'screw', ...screwSoftness(0.01),
        dimensions: [dim('thickness', 'Thickness', 't', 'spindle', rng.range(0.74, 0.8), imp(rng, [0.002, 0.005], 0.006))],
      };
    case 'paper': {
      const sheets = rng.int(20, 100);
      const perSheet = rng.range(0.08, 0.12);
      return {
        kind, label: `Paper stack (${sheets} sheets)`, instrument: 'screw', ...screwSoftness(0.03), sheets,
        dimensions: [dim('thickness', `Thickness of ${sheets} sheets`, 't', 'spindle', sheets * perSheet, imp(rng, [0, 0.001], 0.003))],
      };
    }
  }
}

export function getDimension(obj: MeasurableObject, dimId: string): Dimension {
  const d = obj.dimensions.find((x) => x.id === dimId);
  if (!d) throw new Error(`${obj.kind} has no dimension "${dimId}"`);
  return d;
}

/** The object's true size (mm) along `dimId` for this placement. Hidden from students. */
export function trueSize(obj: MeasurableObject, dimId: string, placement: Placement): number {
  const d = getDimension(obj, dimId);
  const angle = placement.angleDeg + (placement.perpendicular ? 90 : 0);
  const { amp, phaseDeg, taper } = d.imperfection;
  const orient = amp * Math.cos((2 * (angle - phaseDeg) * Math.PI) / 180);
  const along = taper * (2 * placement.along - 1);
  return d.nominalMm + orient + along;
}

/** Largest deviation from nominal the imperfection model allows, mm. */
export function imperfectionBand(d: Dimension): number {
  return Math.abs(d.imperfection.amp) + Math.abs(d.imperfection.taper);
}

/**
 * A new random way of holding the object ("Rotate / reposition"). Keeps the
 * ∥/⊥ choice — that is changed only by the explicit "Rotate 90°" control.
 */
export function randomPlacement(rng: Rng, prev: Placement = DEFAULT_PLACEMENT): Placement {
  return { angleDeg: rng.range(0, 180), along: rng.range(0.1, 0.9), perpendicular: prev.perpendicular };
}

/** "Move along wire": new measuring point, same orientation. */
export function moveAlong(rng: Rng, prev: Placement): Placement {
  return { ...prev, along: rng.range(0.1, 0.9) };
}

/** "Rotate 90°": measure the perpendicular diameter at the same point. */
export function rotate90(prev: Placement): Placement {
  return { ...prev, perpendicular: !prev.perpendicular };
}
