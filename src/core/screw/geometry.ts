/**
 * Screw gauge geometry & kinematics (SPEC §6.2).
 *
 *   s = true gap between anvil and spindle faces (mm)
 *   e = zero-error offset (mm)
 *   p = s + e                    effective scale position = thimble-edge position on the sleeve
 *   θ = (p / pitch) × 360°       thimble rotation
 *
 * Circular scale, viewed side-on as a cylinder of radius R:
 *   division j sits at φ_j = (j / N)·360° − θ measured from the datum line,
 *   screen offset  y = −R·sin φ_j  (SVG: negative y is UP),
 *   visible only on the front half: cos φ_j > 0.08.
 *
 * DIRECTION CONVENTION (tested, S8): numbers increase going UP the visible
 * face; opening the gauge (θ increasing) moves the marks DOWN past the datum
 * line. So with the faces closed, "circular zero BELOW the datum line" means
 * θ > 0, i.e. a POSITIVE zero error — the NCERT rule.
 */
import { EPS } from '../units';
import { circularLabelEvery, SCREW_RANGE_MM, type ScrewConfig } from './config';

/** Minimum cos φ for a circular-scale mark to be drawn (front face). */
export const VISIBLE_COS = 0.08;

export function scalePosition(gapMm: number, zeroOffsetMm: number): number {
  return gapMm + zeroOffsetMm;
}

/** Thimble rotation in degrees for scale position p. */
export function thimbleAngleDeg(pMm: number, c: ScrewConfig): number {
  return (pMm / c.pitch) * 360;
}

/** Inverse of thimbleAngleDeg. */
export function positionFromAngle(angleDeg: number, c: ScrewConfig): number {
  return (angleDeg / 360) * c.pitch;
}

/** Wrap an angle into (−180°, 180°]. */
export function wrapDeg(a: number): number {
  let w = a % 360;
  if (w <= -180) w += 360;
  if (w > 180) w -= 360;
  return w;
}

export type CircularTickSize = 'minor' | 'mid' | 'major';

export interface CircularMark {
  j: number;
  /** Angle from the datum line, degrees, in (−180, 180]. Positive = above the datum. */
  phiDeg: number;
  /** Screen offset from the datum line in units of R (×R for pixels). Negative = up. */
  yOverR: number;
  /** cos φ — use for foreshortening, stroke width and opacity. */
  cos: number;
  size: CircularTickSize;
  label: string | null;
}

/**
 * Visible circular-scale marks for scale position p.
 * Only front-face marks (cos φ > VISIBLE_COS) are returned.
 */
export function circularMarks(pMm: number, c: ScrewConfig): CircularMark[] {
  const theta = thimbleAngleDeg(pMm, c);
  const every = circularLabelEvery(c);
  const marks: CircularMark[] = [];
  for (let j = 0; j < c.n; j++) {
    const phiDeg = wrapDeg((j / c.n) * 360 - theta);
    const rad = (phiDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    if (cos <= VISIBLE_COS) continue;
    marks.push({
      j,
      phiDeg,
      yOverR: -Math.sin(rad),
      cos,
      size: j % every === 0 ? 'major' : c.n >= 100 && j % 5 === 0 ? 'mid' : 'minor',
      label: j % every === 0 ? String(j) : null,
    });
  }
  return marks;
}

/** Screen offset (×R) of circular division j from the datum line. Negative = above. */
export function divisionOffset(j: number, pMm: number, c: ScrewConfig): number {
  const phi = ((j / c.n) * 360 - thimbleAngleDeg(pMm, c)) * (Math.PI / 180);
  return -Math.sin(phi);
}

export type LinearSide = 'upper' | 'lower';

export interface LinearMark {
  posMm: number;
  side: LinearSide;
  /** Major marks are labelled every 5 mm. */
  label: string | null;
  long: boolean;
}

/**
 * Sleeve (linear / pitch scale) marks. Whole mm above the datum line; for
 * 'mm+half' gauges, the half-mm marks below it.
 */
export function linearMarks(c: ScrewConfig, rangeMm: number = SCREW_RANGE_MM): LinearMark[] {
  const marks: LinearMark[] = [];
  for (let mm = 0; mm <= rangeMm; mm++) {
    const five = mm % 5 === 0;
    marks.push({ posMm: mm, side: 'upper', label: five ? String(mm) : null, long: five });
    if (c.linearMarks === 'mm+half' && mm < rangeMm) {
      marks.push({ posMm: mm + 0.5, side: 'lower', label: null, long: false });
    }
  }
  return marks;
}

/** A sleeve mark is uncovered when it lies at or before the thimble edge (which is at p). */
export function isMarkUncovered(markPosMm: number, pMm: number): boolean {
  return markPosMm <= pMm + EPS;
}
