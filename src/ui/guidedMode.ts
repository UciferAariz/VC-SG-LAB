/**
 * Guided activities (SPEC §8.4).
 *  - Vernier, "Find the least count": the vernier zero is put on a main-scale
 *    mark; hovering a vernier mark shades vernier marks 0…k and the same length
 *    on the main scale, so the student sees N VSD = (γN − 1) MSD, then works
 *    out LC = MSD / N.
 *  - Screw gauge, "Find the pitch": the thimble edge position is marked; the
 *    student turns exactly one turn and reads how far the edge moved (= pitch),
 *    counts the circular divisions, and works out LC = pitch / N.
 */
import { sameLength } from '../core/units';
import { formatSig } from '../core/errors';
import { sfx } from '../audio/sfx';
import { answerField, type AnswerField } from './answerField';
import { h } from './controls';
import { t } from './i18n';
import { EXPLORE_FLAGS, type LabAdapter } from './lab';
import type { Mode } from './modeTab';
import { parseDivisionInput, parseNumberInput } from './parse';

interface Question {
  label: string;
  suffix: string;
  integer: boolean;
  correct: () => number;
  /** Extra precondition (e.g. "turn exactly one turn first"). */
  guard?: () => string | null;
}

function quiz(questions: Question[], onAllDone: () => void): { el: HTMLElement; fields: AnswerField[] } {
  const fields: AnswerField[] = [];
  const box = h('div', { class: 'fields' });
  questions.forEach((qn, i) => {
    let tries = 0;
    const f = answerField(qn.label, qn.suffix, (raw) => {
      const g = qn.guard?.();
      if (g) return f.feedback('info', g);
      const v = qn.integer ? parseDivisionInput(raw) : parseNumberInput(raw);
      if (!Number.isFinite(v)) return f.feedback('info', 'Enter a number.');
      tries += 1;
      const want = qn.correct();
      if (qn.integer ? v === want : sameLength(v, want, Math.max(1e-4, Math.abs(want) * 0.01))) {
        sfx.correct();
        f.feedback('correct');
        f.done();
      } else if (tries >= 3) {
        sfx.wrong();
        f.feedback('shown', formatSig(want, 4).replace(/\.?0+$/, ''));
        f.done(formatSig(want, 4).replace(/\.?0+$/, ''));
      } else {
        sfx.wrong();
        f.feedback('wrong', t.attempts(tries));
        return;
      }
      fields[i + 1]?.el.removeAttribute('hidden');
      fields[i + 1]?.focus();
      if (fields.every((x) => x.isDone())) onAllDone();
    }, { inputMode: qn.integer ? 'numeric' : 'decimal' });
    if (i > 0) f.el.setAttribute('hidden', '');
    fields.push(f);
    box.append(f.el);
  });
  return { el: box, fields };
}

const HIDDEN_FLAGS = { hideReadout: true, aidsAllowed: false, revealingOpen: false, hideAriaReading: false };

export function createGuidedVernier(lab: LabAdapter): Mode {
  const g = lab.guided;
  const live = h('p', { class: 'guided-live', 'aria-live': 'polite' }, [t.gdSpanNone]);
  const summary = h('p', { class: 'result-line', hidden: true });
  let k: number | null = null;
  const setK = (v: number | null) => {
    const N = lab.snapshot().N;
    k = v === null ? null : Math.max(0, Math.min(N, v));
    g.setSpan!(k);
    live.textContent = k === null ? t.gdSpanNone : t.gdSpan(k);
  };
  const less = h('button', { type: 'button', class: 'btn' }, [t.gdLess]);
  const more = h('button', { type: 'button', class: 'btn' }, [t.gdMore]);
  less.addEventListener('click', () => setK((k ?? 1) - 1));
  more.addEventListener('click', () => setK((k ?? -1) + 1));
  const setupBtn = h('button', { type: 'button', class: 'btn btn-primary' }, [t.gdSetupV]);
  const setupScales = () => {
    g.alignZero!();
    lab.setLoupe(false);
    window.setTimeout(() => lab.view('scale'), 50);
  };
  setupBtn.addEventListener('click', setupScales);
  const quizBox = h('div');
  const el = h('div', { class: 'mode-panel guided' }, [
    h('h3', { class: 'step-title' }, [t.gdTitleV]),
    h('p', { class: 'prompt' }, [t.gdSetupHelpV]),
    setupBtn,
    live,
    h('div', { class: 'ex-controls' }, [less, more]),
    quizBox,
    summary,
  ]);

  function buildQuiz(): void {
    const s = () => lab.snapshot();
    const span = () => (s().gamma ?? 1) * s().N - 1;
    const { el: qel } = quiz(
      [
        { label: t.gdQ1, suffix: '', integer: true, correct: () => s().N },
        { label: t.gdQ2, suffix: 'MSD', integer: true, correct: span },
        { label: t.gdQ3, suffix: 'mm', integer: false, correct: () => span() / s().N },
        { label: t.gdQ4, suffix: 'mm', integer: false, correct: () => s().lcMm },
      ],
      () => {
        summary.hidden = false;
        summary.textContent = t.gdSummaryV(s().N, span(), formatSig(span() / s().N, 4).replace(/\.?0+$/, ''), formatSig(s().lcMm, 3).replace(/\.?0+$/, ''));
      },
    );
    quizBox.replaceChildren(qel);
    summary.hidden = true;
  }

  const onMove = (e: PointerEvent) => {
    const idx = g.vernierIndexAt!(e.clientX, e.clientY);
    if (idx !== null) setK(idx);
  };
  return {
    id: 'guided',
    title: t.modeGuided,
    desc: t.modeGuidedDescV,
    el,
    enter() {
      lab.setFlags(HIDDEN_FLAGS);
      buildQuiz();
      setupScales();
      setK(null);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerdown', onMove);
    },
    exit() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onMove);
      g.setSpan!(null);
      lab.setFlags(EXPLORE_FLAGS);
    },
  };
}

export function createGuidedScrew(lab: LabAdapter): Mode {
  const g = lab.guided;
  const live = h('p', { class: 'guided-live', 'aria-live': 'off' });
  const oneTurn = h('p', { class: 'feedback fb-correct', hidden: true }, [t.gdOneTurn]);
  const summary = h('p', { class: 'result-line', hidden: true });
  const markBtn = h('button', { type: 'button', class: 'btn btn-primary' }, [t.gdSetupS]);
  const quizBox = h('div');
  const el = h('div', { class: 'mode-panel guided' }, [
    h('h3', { class: 'step-title' }, [t.gdTitleS]),
    h('p', { class: 'prompt' }, [t.gdSetupHelpS]),
    markBtn,
    live,
    oneTurn,
    quizBox,
    summary,
  ]);
  const turned = () => g.sinceStart!()?.turns ?? 0;
  const isOneTurn = () => Math.abs(turned() - 1) <= 0.5 / lab.snapshot().N;

  async function mark(): Promise<void> {
    lab.setObject(null);
    await lab.animateGap(5, 400);
    g.markStart!(true);
    lab.view('scale');
    update();
  }
  markBtn.addEventListener('click', () => void mark());

  function update(): void {
    live.textContent = t.gdTurns(turned().toFixed(2));
    oneTurn.hidden = !isOneTurn();
  }

  function buildQuiz(): void {
    const s = () => lab.snapshot();
    const { el: qel } = quiz(
      [
        { label: t.gdQS1, suffix: 'mm', integer: false, correct: () => s().pitchMm!, guard: () => (isOneTurn() ? null : t.gdTurnFirst) },
        { label: t.gdQS2, suffix: '', integer: true, correct: () => s().N },
        { label: t.gdQS3, suffix: 'mm', integer: false, correct: () => s().lcMm },
      ],
      () => {
        summary.hidden = false;
        summary.textContent = t.gdSummaryS(String(s().pitchMm), s().N, formatSig(s().lcMm, 3).replace(/\.?0+$/, ''));
      },
    );
    quizBox.replaceChildren(qel);
    summary.hidden = true;
  }

  let unsub: (() => void) | null = null;
  return {
    id: 'guided',
    title: t.modeGuidedS,
    desc: t.modeGuidedDescS,
    el,
    enter() {
      lab.setFlags(HIDDEN_FLAGS);
      buildQuiz();
      unsub = lab.subscribe(update);
      void mark();
    },
    exit() {
      unsub?.();
      g.markStart!(false);
      lab.setFlags(EXPLORE_FLAGS);
    },
  };
}
