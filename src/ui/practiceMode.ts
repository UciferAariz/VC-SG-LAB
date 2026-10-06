/**
 * Practice mode (SPEC §8.2). The readout and highlight aids are hidden; a
 * seeded random object and zero error are set up; the student enters LC, ZE,
 * MSR/PSR, VSR/CSR, observed and corrected readings field by field. Answers
 * are checked by core/practice (mistake detection); after 3 attempts a worked
 * solution is shown with the lines highlighted on the instrument.
 */
import { checkAnswer, type PracticeContext, type PracticeField } from '../core/practice';
import { Rng } from '../core/rng';
import { fromUnit } from '../core/units';
import type { ZeroErrorSettings } from '../core/zeroCommon';
import { sfx } from '../audio/sfx';
import { answerField, type AnswerField } from './answerField';
import { h } from './controls';
import { t } from './i18n';
import { EXPLORE_FLAGS, type LabAdapter, type LabSnapshot } from './lab';
import type { Mode } from './modeTab';
import { parseDivisionInput, parseNumberInput } from './parse';
import { answerText, FIELD_LABEL, hintFor, workedSolution } from './practiceText';

type Step = 'lc' | 'ze' | 'measure' | 'corrected' | 'done';

const MAX_ZE_DIV = { vernier: 6, screw: 8 } as const;

export function createPracticeMode(lab: LabAdapter): Mode {
  const header = h('div', { class: 'mode-head' });
  const stepTitle = h('h3', { class: 'step-title' });
  const prompt = h('p', { class: 'prompt' });
  const fieldsBox = h('div', { class: 'fields' });
  const solution = h('div', { class: 'worked', hidden: true, 'aria-live': 'polite' });
  const nextBtn = h('button', { type: 'button', class: 'btn btn-wide btn-primary' }, [t.prNextObject]);
  const el = h('div', { class: 'mode-panel practice' }, [header, stepTitle, prompt, fieldsBox, solution, nextBtn]);

  let round = 0;
  let step: Step = 'lc';
  let score = 0;
  let streak = 0;
  const lcDone = new Set<string>();
  let fields: Partial<Record<PracticeField, AnswerField>> = {};
  let attempts: Partial<Record<PracticeField, number>> = {};
  let studentZeMm: number | undefined;
  let studentObservedMm: number | undefined;
  /** The instrument state when the reading was completed (for the corrected step). */
  let frozen: LabSnapshot | null = null;
  let objectKind = '';
  let dimId = '';
  let savedZero: ZeroErrorSettings | null = null;

  function renderHeader(): void {
    header.textContent = `${t.prRound(round + 1)} · ${t.prScore(score, streak)}`;
  }

  function context(s: LabSnapshot): PracticeContext {
    return {
      instrument: s.instrument,
      lcMm: s.lcMm,
      N: s.N,
      pitchMm: s.pitchMm,
      msrMm: s.msrMm,
      vsr: s.vsr,
      observedMm: s.observedMm,
      ze: s.ze,
      correctedMm: s.correctedMm,
      studentObservedMm,
      studentZeMm,
    };
  }

  function makeField(field: PracticeField, s: LabSnapshot): AnswerField {
    const suffix = field === 'vsr' ? t.prDivBox : s.unit;
    const f = answerField(FIELD_LABEL[field](s), suffix, (raw) => check(field, raw), { inputMode: field === 'vsr' ? 'numeric' : 'decimal' });
    fields[field] = f;
    return f;
  }

  function check(field: PracticeField, raw: string): void {
    const f = fields[field]!;
    const live = lab.snapshot();
    if (field === 'ze' && !live.closed) return f.feedback('info', t.prClosedFirst);
    if ((field === 'msr' || field === 'vsr' || field === 'observed') && (!live.objectKind || !live.touching)) return f.feedback('info', t.prTouchFirst);
    if ((field === 'msr' || field === 'vsr' || field === 'observed') && live.compressionMm > 1e-7) return f.feedback('info', t.prSquashed);
    const s = field === 'corrected' && frozen ? frozen : live;
    const num = field === 'vsr' ? parseDivisionInput(raw) : parseNumberInput(raw);
    if (!Number.isFinite(num)) return f.feedback('info', field === 'vsr' ? 'Enter a whole number of divisions.' : `Enter a number (in ${s.unit}).`);
    const value = field === 'vsr' ? num : fromUnit(num, s.unit);
    const r = checkAnswer(field, value, context(s));
    const n = (attempts[field] ?? 0) + 1;
    attempts[field] = n;
    if (r.verdict === 'correct') {
      sfx.correct();
      if (n === 1) {
        score += 1;
        streak += 1;
      }
      f.feedback('correct', field === 'ze' || field === 'observed' || field === 'corrected' ? answerText(field, s) : '');
      f.done();
      accept(field, value, s);
      return;
    }
    sfx.wrong();
    streak = 0;
    lab.showCandidates(r.verdict === 'close' && (field === 'vsr' || field === 'observed' || field === 'ze'));
    if (n >= 3) {
      f.feedback('shown', `${answerText(field, s)}. ${hintFor(field, r, s)}`);
      f.done(answerText(field, s).replace(/ (mm|cm)$/, ''));
      showSolution(field, s);
      accept(field, field === 'vsr' ? s.vsr : correctValue(field, s), s);
    } else {
      f.feedback(r.verdict === 'close' ? 'close' : 'wrong', `${hintFor(field, r, s)} (${t.attempts(n)})`);
    }
    renderHeader();
  }

  function correctValue(field: PracticeField, s: LabSnapshot): number {
    switch (field) {
      case 'lc':
        return s.lcMm;
      case 'ze':
        return s.ze.zeMm;
      case 'msr':
        return s.msrMm;
      case 'vsr':
        return s.vsr;
      case 'observed':
        return s.observedMm;
      case 'corrected':
        return s.correctedMm;
    }
  }

  function showSolution(field: PracticeField, s: LabSnapshot): void {
    solution.hidden = false;
    solution.replaceChildren(h('strong', {}, [`${t.showSolution}: `]), workedSolution(field, s));
    lab.showWorked(true);
    if (field !== 'lc') lab.view('scale');
  }

  function accept(field: PracticeField, value: number, s: LabSnapshot): void {
    renderHeader();
    if (field === 'lc') {
      lcDone.add(s.configKey);
      window.setTimeout(() => goTo('ze'), 700);
    } else if (field === 'ze') {
      studentZeMm = value;
      window.setTimeout(() => goTo('measure'), 900);
    } else if (field === 'msr' || field === 'vsr' || field === 'observed') {
      if (field === 'observed') studentObservedMm = value;
      if (fields.msr?.isDone() && fields.vsr?.isDone() && fields.observed?.isDone()) {
        frozen = s;
        window.setTimeout(() => goTo('corrected'), 900);
      }
    } else if (field === 'corrected') {
      window.setTimeout(() => goTo('done'), 600);
    }
  }

  function goTo(next: Step): void {
    step = next;
    fields = {};
    attempts = {};
    solution.hidden = true;
    lab.showWorked(false);
    lab.showCandidates(false);
    fieldsBox.replaceChildren();
    nextBtn.hidden = next !== 'done';
    const s = lab.snapshot();
    const objLabel = lab.objects.find((o) => o.kind === objectKind);
    const dimLabel = objLabel?.dims.find((d) => d.id === dimId)?.label.toLowerCase() ?? '';
    switch (next) {
      case 'lc':
        stepTitle.textContent = t.prStepLc;
        prompt.textContent = t.prLcPrompt(s.unit);
        fieldsBox.append(makeField('lc', s).el);
        break;
      case 'ze':
        stepTitle.textContent = t.prStepZe;
        prompt.textContent = lab.instrument === 'screw' ? t.prZePromptS : t.prZePromptV;
        lab.setObject(null);
        fieldsBox.append(makeField('ze', s).el);
        break;
      case 'measure':
        stepTitle.textContent = t.prStepMeasure;
        prompt.textContent = t.prMeasurePrompt(`${dimLabel} of the ${objLabel?.label.toLowerCase() ?? 'object'}`);
        lab.setObject(objectKind, dimId);
        fieldsBox.append(makeField('msr', s).el, makeField('vsr', s).el, makeField('observed', s).el);
        break;
      case 'corrected':
        stepTitle.textContent = t.prStepCorrected;
        prompt.textContent = t.prCorrectedPrompt;
        fieldsBox.append(makeField('corrected', s).el);
        break;
      case 'done':
        stepTitle.textContent = t.prDone;
        prompt.textContent = '';
        break;
    }
    fields[Object.keys(fields)[0] as PracticeField]?.focus();
  }

  function startRound(): void {
    // Seeded: the same session seed gives the whole class the same sequence.
    const rng = new Rng(lab.seed()).fork(`practice:${lab.instrument}:${round}`);
    const obj = rng.pick(lab.objects);
    objectKind = obj.kind;
    dimId = rng.pick(obj.dims).id;
    lab.setZeroSettings({ mode: 'custom', custom: { divisions: rng.int(1, MAX_ZE_DIV[lab.instrument]), sign: rng.sign() } });
    studentZeMm = undefined;
    studentObservedMm = undefined;
    frozen = null;
    renderHeader();
    const first: Step = lcDone.has(lab.snapshot().configKey) ? 'ze' : 'lc';
    goTo(first);
    // Leave the jaws open so the student has to close them for the zero error.
    void lab.animateGap(lab.instrument === 'screw' ? 3 : 12, 400);
  }

  nextBtn.addEventListener('click', () => {
    round += 1;
    startRound();
  });

  return {
    id: 'practice',
    title: t.modePractice,
    desc: t.modePracticeDesc,
    el,
    enter() {
      savedZero = lab.zeroSettings();
      lab.setFlags({ hideReadout: true, aidsAllowed: false, revealingOpen: false, hideAriaReading: true });
      startRound();
    },
    exit() {
      lab.setFlags(EXPLORE_FLAGS);
      lab.showCandidates(false);
      lab.showWorked(false);
      if (savedZero) lab.setZeroSettings(savedZero);
    },
    step: () => step,
  };
}
