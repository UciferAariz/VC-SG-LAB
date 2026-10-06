import { describe, expect, it } from 'vitest';
import { checkAnswer, type PracticeContext } from '../src/core/practice';
import { VERNIER_PRESETS, leastCount } from '../src/core/vernier/config';
import { readVernier } from '../src/core/vernier/reading';
import { vernierZeroError } from '../src/core/vernier/zeroError';
import { SCREW_PRESETS, screwLeastCount } from '../src/core/screw/config';
import { readScrew } from '../src/core/screw/reading';
import { screwZeroError } from '../src/core/screw/zeroError';
import { correctedMm } from '../src/core/zeroCommon';

/** Build the context exactly as the UI will: from core readings only. */
function vernierCtx(gap: number, e: number): PracticeContext {
  const c = VERNIER_PRESETS.standard;
  const r = readVernier(gap + e, c);
  const ze = vernierZeroError(e, c);
  return {
    instrument: 'vernier', lcMm: leastCount(c), N: c.n,
    msrMm: r.msrMm, vsr: r.vsr, observedMm: r.observedMm, ze,
    correctedMm: correctedMm(r.counts, ze.counts, r.lcMm),
  };
}

function screwCtx(gap: number, e: number): PracticeContext {
  const c = SCREW_PRESETS.standard;
  const r = readScrew(gap + e, c);
  const ze = screwZeroError(e, c);
  return {
    instrument: 'screw', lcMm: screwLeastCount(c), N: c.n, pitchMm: c.pitch,
    msrMm: r.psrMm, vsr: r.csr, observedMm: r.observedMm, ze,
    correctedMm: correctedMm(r.counts, ze.counts, r.lcMm),
  };
}

// Vernier: gap 41.3 mm, ZE +0.3 (n = 3) → MSR 41, VSR 6, observed 41.6, corrected 41.3.
const vPos = vernierCtx(41.3, 0.3);
// Vernier: gap 41.9 mm, ZE −0.3 (n = 7) → observed 41.6, corrected 41.9.
const vNeg = vernierCtx(41.9, -0.3);
// Screw: wire 0.82 mm, ZE +0.04 (n = 4) → PSR 0.5 (half-mm mark showing), CSR 36, observed 0.86.
const sPos = screwCtx(0.82, 0.04);

describe('Practice-mode mistake detection (SPEC §14.6)', () => {
  it('context sanity', () => {
    expect([vPos.msrMm, vPos.vsr, vPos.observedMm, vPos.ze.zeMm, vPos.correctedMm]).toEqual([41, 6, 41.6, 0.3, 41.3]);
    expect([vNeg.observedMm, vNeg.ze.zeMm, vNeg.ze.n, vNeg.correctedMm]).toEqual([41.6, -0.3, 7, 41.9]);
    expect([sPos.msrMm, sPos.vsr, sPos.observedMm, sPos.ze.zeMm, sPos.correctedMm]).toEqual([0.5, 36, 0.86, 0.04, 0.82]);
  });

  it('correct answers are accepted', () => {
    expect(checkAnswer('lc', 0.1, vPos)).toEqual({ verdict: 'correct', mistake: null });
    expect(checkAnswer('ze', 0.3, vPos).verdict).toBe('correct');
    expect(checkAnswer('ze', -0.3, vNeg).verdict).toBe('correct');
    expect(checkAnswer('msr', 41, vPos).verdict).toBe('correct');
    expect(checkAnswer('vsr', 6, vPos).verdict).toBe('correct');
    expect(checkAnswer('observed', 41.6, vPos).verdict).toBe('correct');
    expect(checkAnswer('corrected', 41.3, vPos).verdict).toBe('correct');
    expect(checkAnswer('corrected', 41.9, vNeg).verdict).toBe('correct');
    expect(checkAnswer('observed', 0.86, sPos).verdict).toBe('correct');
  });

  it('1. sign error in zero error', () => {
    expect(checkAnswer('ze', -0.3, vPos).mistake).toBe('sign-ze');
    expect(checkAnswer('ze', 0.3, vNeg).mistake).toBe('sign-ze');
    // Negative ZE read as positive with the coinciding division: +7 × 0.1.
    expect(checkAnswer('ze', 0.7, vNeg).mistake).toBe('sign-ze');
    expect(checkAnswer('ze', -0.04, sPos).mistake).toBe('sign-ze');
  });

  it('2. added the zero error instead of subtracting it', () => {
    expect(checkAnswer('corrected', 41.9, vPos)).toEqual({ verdict: 'wrong', mistake: 'added-ze' });
    expect(checkAnswer('corrected', 41.3, vNeg).mistake).toBe('added-ze');
    expect(checkAnswer('corrected', 0.9, sPos).mistake).toBe('added-ze');
    // Also caught against the student's own (wrong) earlier values.
    const own = { ...vPos, studentObservedMm: 41.7, studentZeMm: 0.2 };
    expect(checkAnswer('corrected', 41.9, own).mistake).toBe('added-ze');
  });

  it('3. used the division number instead of division × LC', () => {
    expect(checkAnswer('observed', 41 + 6, vPos).mistake).toBe('division-number'); // mm field
    expect(checkAnswer('observed', (4.1 + 6) * 10, vPos).mistake).toBe('division-number'); // cm field: 4.1 + 6
    expect(checkAnswer('ze', 3, vPos).mistake).toBe('division-number');
    expect(checkAnswer('ze', -7, vNeg).mistake).toBe('division-number');
    expect(checkAnswer('observed', 0.5 + 36, sPos).mistake).toBe('division-number');
    expect(checkAnswer('vsr', 0.6, vPos).mistake).toBe('division-number'); // n × LC typed in the VSR box
  });

  it('4. missed the half-mm mark on the screw gauge', () => {
    expect(checkAnswer('observed', 0.36, sPos)).toEqual({ verdict: 'wrong', mistake: 'half-mm' });
    expect(checkAnswer('msr', 0, sPos).mistake).toBe('half-mm');
    expect(checkAnswer('corrected', 0.32, sPos).mistake).toBe('half-mm');
    // Never flagged on the vernier.
    expect(checkAnswer('observed', 41.1, vPos).mistake).not.toBe('half-mm');
  });

  it('5. used N − n instead of n (or the reverse) for zero error', () => {
    expect(checkAnswer('ze', 0.7, vPos).mistake).toBe('n-vs-N-minus-n'); // +(N − n) for a positive ZE
    expect(checkAnswer('ze', -0.7, vNeg).mistake).toBe('n-vs-N-minus-n'); // −n for a negative ZE
    expect(checkAnswer('ze', 0.46, sPos).mistake).toBe('n-vs-N-minus-n');
    expect(checkAnswer('corrected', 41.6 - 0.7, vPos).mistake).toBe('n-vs-N-minus-n');
  });

  it('6. unit confusion (×10 or ÷10)', () => {
    expect(checkAnswer('observed', 416, vPos).mistake).toBe('unit'); // typed 41.6 into a cm box
    expect(checkAnswer('observed', 4.16, vPos).mistake).toBe('unit');
    expect(checkAnswer('corrected', 413, vPos).mistake).toBe('unit');
    expect(checkAnswer('lc', 1, vPos).mistake).toBe('unit');
    expect(checkAnswer('msr', 410, vPos).mistake).toBe('unit');
    expect(checkAnswer('ze', 0.03, vPos).mistake).toBe('unit');
  });

  it('close: within ±1 LC / ±1 division of the coinciding line', () => {
    expect(checkAnswer('observed', 41.7, vPos)).toEqual({ verdict: 'close', mistake: 'near-line' });
    expect(checkAnswer('observed', 41.5, vPos).verdict).toBe('close');
    expect(checkAnswer('vsr', 7, vPos).verdict).toBe('close');
    expect(checkAnswer('vsr', 5, vPos).verdict).toBe('close');
    expect(checkAnswer('ze', 0.4, vPos).verdict).toBe('close');
    expect(checkAnswer('corrected', 41.4, vPos).verdict).toBe('close');
    expect(checkAnswer('observed', 0.87, sPos).verdict).toBe('close');
    // VSR wraps: 0 and N − 1 are neighbours.
    const atZero = vernierCtx(24.0, 0);
    expect(checkAnswer('vsr', 9, atZero).verdict).toBe('close');
  });

  it('anything else is wrong / unknown', () => {
    expect(checkAnswer('observed', 12.3, vPos)).toEqual({ verdict: 'wrong', mistake: 'unknown' });
    expect(checkAnswer('observed', NaN, vPos).mistake).toBe('unknown');
    expect(checkAnswer('vsr', 2, vPos).mistake).toBe('unknown');
    expect(checkAnswer('lc', 0.3, vPos).mistake).toBe('unknown');
    expect(checkAnswer('msr', 39, vPos).mistake).toBe('unknown');
    expect(checkAnswer('ze', 1.9, vPos).mistake).toBe('unknown');
    expect(checkAnswer('corrected', 30, vPos).mistake).toBe('unknown');
    const noZe = vernierCtx(20, 0);
    expect(checkAnswer('ze', 0.5, noZe).mistake).toBe('unknown');
    expect(checkAnswer('ze', 0, noZe).verdict).toBe('correct');
  });
});
