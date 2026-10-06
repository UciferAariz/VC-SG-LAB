/**
 * Practice-mode wording: the targeted hint for each detected mistake and the
 * step-by-step worked solution (SPEC §8.2). Every number is formatted from
 * the instrument snapshot, which comes from core/.
 */
import type { CheckResult, PracticeField } from '../core/practice';
import { formatLength, type LengthUnit } from '../core/units';
import type { LabSnapshot } from './lab';

const minus = (s: string) => s.replace(/^-/, '−');

export function fmt(mm: number, unit: LengthUnit, lc: number): string {
  return `${minus(formatLength(mm, unit, lc))} ${unit}`;
}

function signedFmt(mm: number, unit: LengthUnit, lc: number): string {
  const s = formatLength(Math.abs(mm), unit, lc);
  return Number(s) === 0 ? `${s} ${unit}` : `${mm < 0 ? '−' : '+'}${s} ${unit}`;
}

const isScrew = (s: LabSnapshot) => s.instrument === 'screw';

export const FIELD_LABEL: Record<PracticeField, (s: LabSnapshot) => string> = {
  lc: () => 'Least count (LC)',
  ze: () => 'Zero error (ZE)',
  msr: (s) => (isScrew(s) ? 'Pitch scale reading (PSR)' : 'Main scale reading (MSR)'),
  vsr: (s) => (isScrew(s) ? 'Circular scale reading (CSR, division number)' : 'Vernier scale reading (VSR, division number)'),
  observed: () => 'Observed reading',
  corrected: () => 'Corrected reading',
};

/** The one-sentence hint for a check result. */
export function hintFor(field: PracticeField, r: CheckResult, s: LabSnapshot): string {
  if (r.verdict === 'correct') return 'Correct!';
  const screw = isScrew(s);
  switch (r.mistake) {
    case 'near-line':
      return screw
        ? 'Close. Look again at which circular division lies exactly on the datum line. The neighbouring divisions are marked in the magnifier.'
        : 'Close. Look again at which line coincides best. The neighbouring lines are marked with how far each is from a main-scale mark.';
    case 'sign-ze':
      return screw
        ? 'Check the sign: circular zero BELOW the datum line means a positive zero error; ABOVE means negative.'
        : 'Check the sign: vernier zero to the RIGHT of the main-scale zero means a positive zero error; to the LEFT means negative.';
    case 'added-ze':
      return 'Corrected reading = Observed reading − Zero error. You added the zero error instead of subtracting it.';
    case 'division-number':
      return field === 'vsr'
        ? 'This box wants the division NUMBER that coincides, not that number multiplied by the least count.'
        : 'Multiply the coinciding division by the least count: use n × LC, not n itself.';
    case 'half-mm':
      return 'Look below the datum line: has a half-millimetre mark been uncovered? Your answer is off by exactly 0.5 mm.';
    case 'n-vs-N-minus-n':
      return 'For a positive zero error use +n × LC. For a negative zero error use −(N − n) × LC. You used the other rule.';
    case 'unit':
      return `Check your units: your answer is 10 times too big or too small. This box is in ${field === 'vsr' ? 'divisions' : s.unit}.`;
    default:
      return genericHint(field, s);
  }
}

function genericHint(field: PracticeField, s: LabSnapshot): string {
  const screw = isScrew(s);
  switch (field) {
    case 'lc':
      return screw ? 'LC = pitch / number of circular divisions.' : 'LC = 1 MSD / number of vernier divisions (1 MSD − 1 VSD).';
    case 'ze':
      return screw ? 'With the faces touching, read the circular division on the datum line.' : 'With the jaws closed, find the vernier line that coincides with a main-scale line.';
    case 'msr':
      return screw ? 'Read the last linear-scale mark the thimble edge has uncovered, including half-mm marks.' : 'Read the last main-scale mark to the LEFT of the vernier zero.';
    case 'vsr':
      return screw ? 'Which circular division lies on the datum line?' : 'Which vernier line lines up exactly with a main-scale line?';
    case 'observed':
      return screw ? 'Observed = PSR + CSR × LC.' : 'Observed = MSR + VSR × LC.';
    case 'corrected':
      return 'Corrected = Observed − Zero error (mind the sign of the zero error).';
  }
}

/** The correct answer for a field, formatted for the box. */
export function answerText(field: PracticeField, s: LabSnapshot): string {
  const u = s.unit;
  const lc = s.lcMm;
  switch (field) {
    case 'lc':
      return fmt(lc, u, lc);
    case 'ze':
      return signedFmt(s.ze.zeMm, u, lc);
    case 'msr':
      return fmt(s.msrMm, u, lc);
    case 'vsr':
      return String(s.vsr);
    case 'observed':
      return fmt(s.observedMm, u, lc);
    case 'corrected':
      return fmt(s.correctedMm, u, lc);
  }
}

/** Worked solution for one step (shown after 3 attempts). */
export function workedSolution(field: PracticeField, s: LabSnapshot): string {
  const u = s.unit;
  const lc = s.lcMm;
  const lcU = fmt(lc, u, lc);
  const screw = isScrew(s);
  switch (field) {
    case 'lc':
      if (screw) {
        const pitch = `${formatLength(s.pitchMm ?? 0.5, 'mm', 0.1)} mm`;
        return `LC = pitch / N = ${pitch} / ${s.N} = ${fmt(lc, 'mm', lc)}${u === 'mm' ? '' : ` = ${lcU}`}.`;
      }
      return `${s.N} VSD = ${(s.gamma ?? 1) * s.N - 1} MSD, so LC = 1 MSD / N = 1 mm / ${s.N} = ${fmt(lc, 'mm', lc)}${u === 'mm' ? '' : ` = ${lcU}`}.`;
    case 'ze': {
      const z = s.ze;
      if (z.kind === 'none') return screw ? 'The circular zero is exactly on the datum line: no zero error, ZE = 0.' : 'The vernier zero coincides with the main-scale zero: no zero error, ZE = 0.';
      const where = screw ? (z.kind === 'positive' ? 'below the datum line' : 'above the datum line') : z.kind === 'positive' ? 'to the right of the main-scale zero' : 'to the left of the main-scale zero';
      const zero = screw ? 'The circular-scale zero is' : 'The vernier zero is';
      const line = screw ? `division ${z.n} lies on the datum line` : `vernier division ${z.n} coincides`;
      const rule = z.kind === 'positive' ? `ZE = +n × LC = +${z.n} × ${lcU}` : `ZE = −(N − n) × LC = −(${z.N} − ${z.n}) × ${lcU}`;
      return `${zero} ${where}, so the zero error is ${z.kind}. With the ${screw ? 'faces touching' : 'jaws closed'}, ${line}. ${rule} = ${signedFmt(z.zeMm, u, lc)}.`;
    }
    case 'msr':
      if (screw) {
        const half = s.halfMmVisible;
        const whole = half ? s.msrMm - 0.5 : s.msrMm;
        return half
          ? `The thimble edge has uncovered the ${formatLength(whole, 'mm', 1)} mm mark AND the half-mm mark below the datum line after it, so PSR = ${formatLength(whole, 'mm', 1)} + 0.5 = ${fmt(s.msrMm, u, lc)}.`
          : `The last mark the thimble edge has uncovered is the ${formatLength(whole, 'mm', 1)} mm mark (no half-mm mark after it), so PSR = ${fmt(s.msrMm, u, lc)}.`;
      }
      return `The vernier zero lies just past the ${fmt(s.msrMm, u, 1)} mark on the main scale, so MSR = ${fmt(s.msrMm, u, lc)}.`;
    case 'vsr':
      return screw ? `Circular division ${s.vsr} lies on the datum line (highlighted), so CSR = ${s.vsr}.` : `Vernier line ${s.vsr} coincides best with a main-scale line (highlighted), so VSR = ${s.vsr}.`;
    case 'observed':
      return screw
        ? `Observed = PSR + CSR × LC = ${fmt(s.msrMm, u, lc)} + ${s.vsr} × ${lcU} = ${fmt(s.observedMm, u, lc)}.`
        : `Observed = MSR + VSR × LC = ${fmt(s.msrMm, u, lc)} + ${s.vsr} × ${lcU} = ${fmt(s.observedMm, u, lc)}.`;
    case 'corrected':
      return `Corrected = Observed − ZE = ${fmt(s.observedMm, u, lc)} − (${signedFmt(s.ze.zeMm, u, lc)}) = ${fmt(s.correctedMm, u, lc)}.`;
  }
}
