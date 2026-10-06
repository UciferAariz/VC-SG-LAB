/**
 * Practice-mode answer checking and mistake detection (SPEC §8.2).
 *
 * Pure logic: the UI converts what the student typed into mm (or a plain
 * division count for the VSR/CSR field) and turns the returned mistake code
 * into a hint in the current language.
 *
 * Checks, in priority order:
 *   correct  — exact match with the correct quantised value
 *   specific — a recognised mistake (sign of ZE, added ZE, division number
 *              instead of n × LC, missed half-mm mark, n vs N − n, ×10 unit slip)
 *   close    — within ±1 LC / ±1 division of the coinciding line
 *   wrong    — anything else
 */
import { EPS, sameLength } from './units';
import type { ZeroErrorInfo } from './zeroCommon';

export type PracticeField = 'lc' | 'ze' | 'msr' | 'vsr' | 'observed' | 'corrected';

export type Verdict = 'correct' | 'close' | 'wrong';

export type MistakeCode =
  | 'sign-ze' // read a positive ZE as negative or vice versa
  | 'added-ze' // corrected = observed + ZE instead of observed − ZE
  | 'division-number' // used the division number n instead of n × LC
  | 'half-mm' // missed (or wrongly added) the half-mm mark on a 0.5 mm pitch gauge
  | 'n-vs-N-minus-n' // used N − n where n was needed, or the reverse
  | 'unit' // mm/cm slip: off by exactly ×10 or ÷10
  | 'near-line' // "close": a neighbouring line was chosen
  | 'unknown';

export interface PracticeContext {
  instrument: 'vernier' | 'screw';
  lcMm: number;
  /** Divisions on the vernier / circular scale. */
  N: number;
  /** Screw gauge pitch, mm. */
  pitchMm?: number;
  /** Correct MSR / PSR, mm. */
  msrMm: number;
  /** Correct VSR / CSR (division count). */
  vsr: number;
  observedMm: number;
  ze: ZeroErrorInfo;
  correctedMm: number;
  /** The student's own earlier answers, if any — used to spot "added the ZE". */
  studentObservedMm?: number;
  studentZeMm?: number;
}

export interface CheckResult {
  verdict: Verdict;
  mistake: MistakeCode | null;
}

const OK: CheckResult = { verdict: 'correct', mistake: null };
const wrong = (mistake: MistakeCode): CheckResult => ({ verdict: 'wrong', mistake });
const close: CheckResult = { verdict: 'close', mistake: 'near-line' };

function isUnitSlip(student: number, correct: number, lc: number): boolean {
  if (Math.abs(correct) < EPS) return false;
  return sameLength(student, correct * 10, lc) || sameLength(student, correct / 10, lc / 10);
}

function isHalfMmSlip(student: number, correct: number, ctx: PracticeContext): boolean {
  return ctx.instrument === 'screw' && ctx.pitchMm === 0.5 && sameLength(Math.abs(student - correct), 0.5, ctx.lcMm);
}

function withinOneLc(student: number, correct: number, lc: number): boolean {
  return Math.abs(student - correct) <= lc * (1 + 1e-6);
}

/** The ZE a student gets by using the "other" rule (N − n instead of n, or the reverse). */
function swappedZeMagnitude(ze: ZeroErrorInfo): number {
  const nUsed = ze.kind === 'negative' ? ze.n : ze.N - ze.n;
  return nUsed * ze.lcMm;
}

function checkZe(s: number, ctx: PracticeContext): CheckResult {
  const { ze, lcMm: lc } = ctx;
  const correct = ze.zeMm;
  if (sameLength(s, correct, lc)) return OK;
  if (ze.kind !== 'none') {
    const sign = ze.kind === 'positive' ? 1 : -1;
    const swapped = swappedZeMagnitude(ze);
    // Read as the opposite kind of zero error: either −correct, or the other rule with the other sign.
    if (sameLength(s, -correct, lc) || sameLength(s, -sign * swapped, lc)) return wrong('sign-ze');
    if (sameLength(s, sign * swapped, lc)) return wrong('n-vs-N-minus-n');
    // Typed the division number itself (n or N − n), with either sign.
    const nums = [ze.n, ze.N - ze.n];
    if (nums.some((n) => n !== 0 && (sameLength(Math.abs(s), n, lc) || sameLength(Math.abs(s), n * 10, lc)))) {
      return wrong('division-number');
    }
  }
  if (withinOneLc(s, correct, lc)) return close;
  if (isUnitSlip(s, correct, lc)) return wrong('unit');
  return wrong('unknown');
}

function checkObserved(s: number, ctx: PracticeContext): CheckResult {
  const lc = ctx.lcMm;
  const correct = ctx.observedMm;
  if (sameLength(s, correct, lc)) return OK;
  if (withinOneLc(s, correct, lc)) return close;
  if (isHalfMmSlip(s, correct, ctx)) return wrong('half-mm');
  // MSR + n instead of MSR + n × LC — in mm (MSR mm + n) or cm (MSR cm + n, i.e. +10n mm).
  if (ctx.vsr !== 0 && (sameLength(s, ctx.msrMm + ctx.vsr, lc) || sameLength(s, ctx.msrMm + 10 * ctx.vsr, lc))) {
    return wrong('division-number');
  }
  if (isUnitSlip(s, correct, lc)) return wrong('unit');
  return wrong('unknown');
}

function checkCorrected(s: number, ctx: PracticeContext): CheckResult {
  const lc = ctx.lcMm;
  const correct = ctx.correctedMm;
  if (sameLength(s, correct, lc)) return OK;
  const { ze } = ctx;
  if (ze.kind !== 'none') {
    if (sameLength(s, ctx.observedMm + ze.zeMm, lc)) return wrong('added-ze');
    const sObs = ctx.studentObservedMm;
    const sZe = ctx.studentZeMm;
    if (sObs !== undefined && sZe !== undefined && Math.abs(sZe) > EPS && sameLength(s, sObs + sZe, lc)) {
      return wrong('added-ze');
    }
    const sign = ze.kind === 'positive' ? 1 : -1;
    if (sameLength(s, ctx.observedMm - sign * swappedZeMagnitude(ze), lc)) return wrong('n-vs-N-minus-n');
  }
  if (withinOneLc(s, correct, lc)) return close;
  if (isHalfMmSlip(s, correct, ctx)) return wrong('half-mm');
  if (isUnitSlip(s, correct, lc)) return wrong('unit');
  return wrong('unknown');
}

function checkMsr(s: number, ctx: PracticeContext): CheckResult {
  const lc = ctx.lcMm;
  if (sameLength(s, ctx.msrMm, lc)) return OK;
  if (isHalfMmSlip(s, ctx.msrMm, ctx)) return wrong('half-mm');
  if (isUnitSlip(s, ctx.msrMm, lc)) return wrong('unit');
  return wrong('unknown');
}

function checkVsr(s: number, ctx: PracticeContext): CheckResult {
  if (Math.abs(s - ctx.vsr) < EPS) return OK;
  const diff = Math.abs(s - ctx.vsr);
  if (Math.abs(diff - 1) < EPS || Math.abs(diff - (ctx.N - 1)) < EPS) return close;
  // Entered n × LC (in mm or cm) where the division number was asked.
  if (ctx.vsr !== 0 && (sameLength(s, ctx.vsr * ctx.lcMm, ctx.lcMm / 10) || sameLength(s, (ctx.vsr * ctx.lcMm) / 10, ctx.lcMm / 10))) {
    return wrong('division-number');
  }
  return wrong('unknown');
}

function checkLc(s: number, ctx: PracticeContext): CheckResult {
  if (sameLength(s, ctx.lcMm, ctx.lcMm)) return OK;
  if (isUnitSlip(s, ctx.lcMm, ctx.lcMm)) return wrong('unit');
  return wrong('unknown');
}

/**
 * Check one practice-mode answer.
 * @param value the student's answer in mm (or a division count for 'vsr').
 */
export function checkAnswer(field: PracticeField, value: number, ctx: PracticeContext): CheckResult {
  if (!Number.isFinite(value)) return wrong('unknown');
  switch (field) {
    case 'lc':
      return checkLc(value, ctx);
    case 'ze':
      return checkZe(value, ctx);
    case 'msr':
      return checkMsr(value, ctx);
    case 'vsr':
      return checkVsr(value, ctx);
    case 'observed':
      return checkObserved(value, ctx);
    case 'corrected':
      return checkCorrected(value, ctx);
  }
}
