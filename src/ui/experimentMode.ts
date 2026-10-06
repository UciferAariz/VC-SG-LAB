/**
 * Experiment mode (SPEC §8.3): least count → zero error → n readings with
 * repositioning → error analysis → derived quantity → CSV / print / copy.
 * The table auto-fills from the instrument, or (manual mode) the student types
 * every value and each is checked with core/practice.
 */
import { checkAnswer, type PracticeField } from '../core/practice';
import { fromUnit, sameLength } from '../core/units';
import { sfx } from '../audio/sfx';
import { answerField, type AnswerField } from './answerField';
import { h, iconButton, segmented, select, toggle } from './controls';
import { errorWorkings, stdDevLine } from './errorWorkings';
import {
  analyse,
  clampReadings,
  derivedResult,
  missingForDerived,
  recordProblem,
  rowFromSnapshot,
  sameAsLastPlacement,
  tableColumns,
  type Experiment,
  type QuantityRecord,
} from './experimentModel';
import { buildCsv, lcText, printSheet, resultSummary, resultText, zeText } from './export';
import { icons } from './icons';
import { t } from './i18n';
import { EXPLORE_FLAGS, type LabAdapter, type LabSnapshot } from './lab';
import type { Mode } from './modeTab';
import { renderTable, renderWorkings, renderWorkingsFlat } from './observationTable';
import { parseDivisionInput, parseNumberInput } from './parse';
import { answerText, FIELD_LABEL, hintFor } from './practiceText';

type Entry = 'auto' | 'manual';

export function createExperimentMode(lab: LabAdapter): Mode {
  const el = h('div', { class: 'mode-panel experiment' });

  // ── Setup ──────────────────────────────────────────────────────────────────
  let objKind = lab.objects[0]!.kind;
  let dimId = lab.objects[0]!.dims[0]!.id;
  let wanted = 5;
  let entry: Entry = 'auto';
  const objSel = select<string>(t.exObject, lab.objects.map((o) => ({ value: o.kind, label: o.label })), objKind, (v) => {
    objKind = v;
    dimId = obj().dims[0]!.id;
    fillDims();
  });
  const dimSel = h('select', { id: 'ex-dim' });
  dimSel.addEventListener('change', () => (dimId = dimSel.value));
  const dimField = h('div', { class: 'field' }, [h('label', { for: 'ex-dim' }, [t.exQuantity]), dimSel]);
  const nInput = h('input', { type: 'number', id: 'ex-n', min: 3, max: 10, step: 1, value: 5 });
  nInput.addEventListener('change', () => {
    wanted = clampReadings(Number(nInput.value));
    nInput.value = String(wanted);
  });
  const entrySeg = segmented<Entry>(t.exEntry, [{ value: 'auto', label: t.exAuto }, { value: 'manual', label: t.exManual }], entry, (v) => (entry = v));
  const startBtn = h('button', { type: 'button', class: 'btn btn-wide btn-primary' }, [t.exStart]);
  const setup = h('section', { class: 'ex-setup' }, [objSel.el, dimField, h('div', { class: 'field' }, [h('label', { for: 'ex-n' }, [t.exReadings]), nInput]), entrySeg.el, startBtn]);

  const obj = () => lab.objects.find((o) => o.kind === objKind)!;
  function fillDims(): void {
    dimSel.replaceChildren(...obj().dims.map((d) => h('option', { value: d.id }, [d.label])));
    dimSel.value = dimId;
    dimField.hidden = obj().dims.length < 2;
  }
  fillDims();

  // ── Experiment state ──────────────────────────────────────────────────────
  let exp: Experiment | null = null;
  let active = 0;
  let lcDone = false;
  let showSd = false;
  let pendingSameSpot = false;
  const steps = h('div', { class: 'ex-steps' });
  el.append(setup, steps);

  const q = (): QuantityRecord => exp!.quantities[active]!;

  function section(title: string, done: boolean, ...children: (Node | null)[]): HTMLElement {
    return h('section', { class: `ex-step${done ? ' done' : ''}` }, [h('h3', { class: 'step-title' }, [done ? `✓ ${title}` : title]), ...children]);
  }

  // ── Step 1: least count ───────────────────────────────────────────────────
  function lcStep(): HTMLElement {
    const s = lab.snapshot();
    if (lcDone) return section(t.exStep1, true, h('p', {}, [t.exLcDone(lcText(exp!))]));
    const box = h('div', { class: 'fields' });
    const fields: AnswerField[] = [];
    const tries = new Map<AnswerField, number>();
    const add = (label: string, suffix: string, correct: number, eq: (v: number) => boolean, shown: string, numeric = false) => {
      const f = answerField(label, suffix, (raw) => {
        const v = numeric ? parseDivisionInput(raw) : parseNumberInput(raw);
        if (!Number.isFinite(v)) return f.feedback('info', 'Enter a number.');
        const n = (tries.get(f) ?? 0) + 1;
        tries.set(f, n);
        if (eq(v)) {
          sfx.correct();
          f.feedback('correct');
          f.done();
        } else if (n >= 3) {
          sfx.wrong();
          f.feedback('shown', shown);
          f.done(String(correct));
        } else {
          sfx.wrong();
          f.feedback('wrong', t.attempts(n));
        }
        if (fields.every((x) => x.isDone())) {
          lcDone = true;
          window.setTimeout(render, 600);
        }
      }, { inputMode: numeric ? 'numeric' : 'decimal' });
      fields.push(f);
      box.append(f.el);
    };
    const lcU = fromUnit(1, s.unit);
    if (s.instrument === 'vernier') {
      const span = (s.gamma ?? 1) * s.N - 1;
      add(t.exNPrompt, '', s.N, (v) => v === s.N, String(s.N), true);
      add(t.exSpanPrompt, 'MSD', span, (v) => v === span, String(span), true);
    } else {
      add(t.exPitchPrompt, 'mm', s.pitchMm!, (v) => sameLength(v, s.pitchMm!, 0.01), `${s.pitchMm} mm`);
      add(t.exNPrompt, '', s.N, (v) => v === s.N, String(s.N), true);
    }
    add(t.exLcPrompt(s.unit), s.unit, s.lcMm / lcU, (v) => sameLength(v * lcU, s.lcMm, s.lcMm), answerText('lc', s));
    return section(t.exStep1, false, box);
  }

  // ── Step 2: zero error ────────────────────────────────────────────────────
  let zeBtn: HTMLButtonElement | null = null;
  function zeStep(): HTMLElement {
    if (exp!.ze) return section(t.exStep2, true, h('p', {}, [t.exZeDone(zeText(exp!))]));
    if (!lcDone) return section(t.exStep2, false, h('p', { class: 'hint' }, ['…']));
    const accept = (s: LabSnapshot) => {
      exp!.ze = s.ze;
      lab.setObject(objKind, q().dimId);
      render();
    };
    const parts: Node[] = [h('p', { class: 'prompt' }, [t.exZeClose])];
    if (entry === 'auto') {
      zeBtn = h('button', { type: 'button', class: 'btn btn-primary' }, [t.exZeRecord]);
      zeBtn.addEventListener('click', () => {
        const s = lab.snapshot();
        if (!s.closed) return lab.flash(t.prClosedFirst);
        sfx.correct();
        accept(s);
      });
      parts.push(zeBtn);
    } else {
      let n = 0;
      const f = answerField(t.exZeManual(lab.snapshot().unit), lab.snapshot().unit, (raw) => {
        const s = lab.snapshot();
        if (!s.closed) return f.feedback('info', t.prClosedFirst);
        const v = parseNumberInput(raw);
        if (!Number.isFinite(v)) return f.feedback('info', 'Enter a number.');
        const r = checkAnswer('ze', fromUnit(v, s.unit), ctx(s));
        n += 1;
        if (r.verdict === 'correct' || n >= 3) {
          if (r.verdict === 'correct') sfx.correct();
          f.feedback(r.verdict === 'correct' ? 'correct' : 'shown', answerText('ze', s));
          f.done();
          window.setTimeout(() => accept(s), 700);
        } else {
          sfx.wrong();
          f.feedback(r.verdict === 'close' ? 'close' : 'wrong', `${hintFor('ze', r, s)} (${t.attempts(n)})`);
        }
      });
      parts.push(f.el);
    }
    return section(t.exStep2, false, ...parts);
  }

  function ctx(s: LabSnapshot) {
    return { instrument: s.instrument, lcMm: s.lcMm, N: s.N, pitchMm: s.pitchMm, msrMm: s.msrMm, vsr: s.vsr, observedMm: s.observedMm, ze: s.ze, correctedMm: s.correctedMm };
  }

  // ── Step 3: readings ──────────────────────────────────────────────────────
  const status = h('p', { class: 'ex-status', 'aria-live': 'polite' });
  let recordBtn: HTMLButtonElement | null = null;
  function problemText(p: ReturnType<typeof recordProblem>): string {
    return p === 'no-ze' ? t.exNeedZe : p === 'not-touching' ? t.exNotTouching : p === 'squashed' ? t.exSquashed : p === 'table-full' ? t.exFull : '';
  }

  function addRow(s: LabSnapshot, source: 'auto' | 'manual'): void {
    q().rows.push(rowFromSnapshot(s, source));
    pendingSameSpot = false;
    sfx.correct();
    render();
  }

  function readingsStep(): HTMLElement {
    if (!exp!.ze) return section(t.exStep3, false, h('p', { class: 'hint' }, ['…']));
    const full = q().rows.length >= exp!.readingsWanted;
    const tc = tableColumns(exp!, q());
    const parts: Node[] = [];
    if (exp!.quantities.length > 1) {
      parts.push(
        segmented<string>(t.exQuantity, exp!.quantities.map((x, i) => ({ value: String(i), label: `${x.dimLabel} (${x.symbol})` })), String(active), (v) => {
          active = Number(v);
          lab.setObject(objKind, q().dimId);
          render();
        }).el,
      );
    }
    // Panel view: the n × LC column shows just the product (print and CSV keep "n × LC = …").
    const compact = tc.rows.map((r) => r.map((c) => (c.includes(' = ') ? c.split(' = ').pop()! : c)));
    parts.push(
      h('div', { class: 'table-scroll' }, [renderTable(tc.head, compact, `${q().dimLabel} (${q().symbol})`, '—')]),
      h('p', { class: 'hint' }, [t.exCount(q().rows.length, exp!.readingsWanted)]),
    );
    const controls = h('div', { class: 'ex-controls' });
    if (!full) {
      if (entry === 'auto') {
        recordBtn = iconButton(icons.record, t.exRecord, () => {
          const s = lab.snapshot();
          const p = recordProblem(exp!, q(), s);
          if (p) return lab.flash(problemText(p));
          if (sameAsLastPlacement(q(), s) && !pendingSameSpot) {
            pendingSameSpot = true;
            status.replaceChildren(t.exSameSpot, ' ', anyway);
            return;
          }
          addRow(s, 'auto');
        }, { text: t.exRecord, cls: 'btn-primary' });
        controls.append(recordBtn);
      } else {
        controls.append(manualForm());
      }
    }
    controls.append(iconButton(icons.rotate, t.exReposition, () => lab.reposition(), { text: t.exReposition }));
    if (lab.rotate90 && objKind === 'wire') controls.append(iconButton(icons.rotate, t.sgRotate90, () => lab.rotate90!(), { text: t.sgRotate90 }));
    if (q().rows.length > 0)
      controls.append(
        iconButton(icons.trash, t.exDeleteLast, () => {
          q().rows.pop();
          render();
        }, { text: t.exDeleteLast }),
      );
    parts.push(controls, status);
    return section(t.exStep3, full, ...parts);
  }

  const anyway = h('button', { type: 'button', class: 'btn btn-small' }, [t.exRecordAnyway]);
  anyway.addEventListener('click', () => {
    const s = lab.snapshot();
    const p = recordProblem(exp!, q(), s);
    if (p) return lab.flash(problemText(p));
    addRow(s, 'auto');
  });

  function manualForm(): HTMLElement {
    const s0 = lab.snapshot();
    const order: PracticeField[] = ['msr', 'vsr', 'observed', 'corrected'];
    const values = new Map<PracticeField, string>();
    const fields = order.map((field) => {
      const f = answerField(FIELD_LABEL[field](s0), field === 'vsr' ? t.prDivBox : s0.unit, () => checkAll(), { inputMode: field === 'vsr' ? 'numeric' : 'decimal' });
      f.input.addEventListener('input', () => values.set(field, f.input.value));
      return { field, f };
    });
    const addBtn = h('button', { type: 'button', class: 'btn btn-primary' }, [t.exAddRow]);
    const checkAll = () => {
      const s = lab.snapshot();
      const p = recordProblem(exp!, q(), s);
      if (p) return lab.flash(problemText(p));
      let ok = true;
      for (const { field, f } of fields) {
        const raw = f.input.value;
        const v = field === 'vsr' ? parseDivisionInput(raw) : parseNumberInput(raw);
        if (!Number.isFinite(v)) {
          f.feedback('info', 'Enter a number.');
          ok = false;
          continue;
        }
        const r = checkAnswer(field, field === 'vsr' ? v : fromUnit(v, s.unit), ctx(s));
        f.feedback(r.verdict === 'correct' ? 'correct' : r.verdict === 'close' ? 'close' : 'wrong', r.verdict === 'correct' ? '' : hintFor(field, r, s));
        if (r.verdict !== 'correct') ok = false;
      }
      if (!ok) return sfx.wrong();
      if (sameAsLastPlacement(q(), s)) lab.flash(t.exSameSpot);
      addRow(s, 'manual');
    };
    addBtn.addEventListener('click', checkAll);
    return h('div', { class: 'manual-form' }, [...fields.map((x) => x.f.el), addBtn]);
  }

  // ── Step 4: analysis ──────────────────────────────────────────────────────
  function analysisStep(): HTMLElement {
    if (!exp!.ze) return section(t.exStep4, false, h('p', { class: 'hint' }, ['…']));
    const a = analyse(exp!, q());
    if (!a) return section(t.exStep4, false, h('p', { class: 'hint' }, [t.exAnalysisWait(3)]));
    const lines = errorWorkings(a, q().symbol, exp!.unit);
    if (showSd) lines.splice(lines.length - 1, 0, stdDevLine(a, q().symbol, exp!.unit));
    const sd = toggle(t.exStdDev, showSd, (on) => {
      showSd = on;
      render();
    });
    const remaining = obj().dims.filter((d) => !exp!.quantities.some((x) => x.dimId === d.id));
    let another: HTMLElement | null = null;
    if (remaining.length > 0 && q().rows.length >= exp!.readingsWanted) {
      const sel = h('select', { id: 'ex-another' }, remaining.map((d) => h('option', { value: d.id }, [d.label])));
      const go = h('button', { type: 'button', class: 'btn' }, [t.start]);
      go.addEventListener('click', () => {
        const d = obj().dims.find((x) => x.id === sel.value)!;
        exp!.quantities.push({ dimId: d.id, dimLabel: d.label, symbol: d.symbol, rows: [] });
        active = exp!.quantities.length - 1;
        lab.setObject(objKind, d.id);
        render();
      });
      another = h('div', { class: 'field' }, [h('label', { for: 'ex-another' }, [t.exAnotherQty]), h('div', { class: 'seed-row' }, [sel, go])]);
    }
    return section(t.exStep4, false, renderWorkings(lines), h('p', { class: 'result-line' }, [resultText(exp!, q()) ?? '']), sd.el, another);
  }

  // ── Step 5: derived quantity ──────────────────────────────────────────────
  function derivedStep(): HTMLElement | null {
    if (!exp!.ze || !exp!.quantities.some((x) => analyse(exp!, x))) return null;
    if (!exp!.derived) return section(t.exStep5, false, h('p', { class: 'hint' }, [t.exDerivedNone]));
    const missing = missingForDerived(exp!);
    if (missing.length > 0) return section(t.exStep5, false, h('p', { class: 'hint' }, [t.exDerivedNeed(missing.join(', '))]));
    const dr = derivedResult(exp!)!;
    return section(
      `${t.exStep5}: ${dr.name}`,
      false,
      renderWorkings(dr.steps.map((s) => ({ title: s.label, symbolic: s.symbolic, numeric: s.numeric }))),
      h('p', { class: 'result-line' }, [dr.resultText]),
    );
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function exportBox(): HTMLElement | null {
    if (!exp || !exp.quantities.some((x) => analyse(exp!, x))) return null;
    const csv = iconButton(icons.download, t.exCsv, () => {
      const blob = new Blob([buildCsv(exp!)], { type: 'text/csv;charset=utf-8' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `riz-lab-${exp!.instrument}-${exp!.objectKind}.csv` });
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, { text: t.exCsv });
    const print = iconButton(icons.print, t.exPrint, () => {
      fillPrintSheet(exp!);
      window.print();
    }, { text: t.exPrint });
    const copy = iconButton(icons.copy, t.exCopy, async () => {
      try {
        await navigator.clipboard.writeText(resultSummary(exp!));
        lab.flash(t.exCopied);
      } catch {
        lab.flash(resultSummary(exp!));
      }
    }, { text: t.exCopy });
    return h('section', { class: 'ex-step ex-export' }, [h('h3', { class: 'step-title' }, [t.exExport]), h('div', { class: 'ex-controls' }, [csv, print, copy])]);
  }

  function render(): void {
    if (!exp) {
      setup.hidden = false;
      steps.replaceChildren();
      return;
    }
    setup.hidden = true;
    const restart = h('button', { type: 'button', class: 'btn btn-small' }, [t.exRestart]);
    restart.addEventListener('click', () => {
      exp = null;
      lab.setFlags(EXPLORE_FLAGS);
      render();
    });
    const head = h('div', { class: 'mode-head' }, [`${exp.objectLabel} · ${exp.instrument === 'vernier' ? t.vernierTitle : t.screwTitle} `, restart]);
    status.textContent = '';
    steps.replaceChildren(head, lcStep(), zeStep(), readingsStep(), analysisStep(), ...[derivedStep(), exportBox()].filter((x): x is HTMLElement => x !== null));
    liveUpdate();
  }

  /** Cheap per-frame updates: whether Record / Record ZE are available. */
  function liveUpdate(): void {
    if (!exp) return;
    const s = lab.snapshot();
    if (zeBtn) zeBtn.disabled = !s.closed;
    if (recordBtn && exp.ze) {
      const p = recordProblem(exp, q(), s);
      recordBtn.disabled = p !== null;
      if (!pendingSameSpot) status.textContent = p ? problemText(p) : '';
    }
  }

  startBtn.addEventListener('click', () => {
    const s = lab.snapshot();
    const o = obj();
    const d = o.dims.find((x) => x.id === dimId) ?? o.dims[0]!;
    exp = {
      instrument: s.instrument,
      unit: s.unit,
      lcMm: s.lcMm,
      N: s.N,
      pitchMm: s.pitchMm,
      msdMm: s.msdMm,
      gamma: s.gamma,
      configLabel: s.configLabel,
      objectKind: o.kind,
      objectLabel: o.label,
      aimNoun: o.aimNoun,
      derived: o.derived,
      readingsWanted: wanted,
      ze: null,
      quantities: [{ dimId: d.id, dimLabel: d.label, symbol: d.symbol, rows: [] }],
    };
    active = 0;
    lcDone = false;
    pendingSameSpot = false;
    lab.setFlags(entry === 'manual' ? { hideReadout: true, aidsAllowed: false, revealingOpen: false, hideAriaReading: true } : { ...EXPLORE_FLAGS, revealingOpen: false });
    lab.setObject(null);
    void lab.animateGap(lab.instrument === 'screw' ? 3 : 12, 400);
    render();
  });

  let unsub: (() => void) | null = null;
  return {
    id: 'experiment',
    title: t.modeExperiment,
    desc: t.modeExperimentDesc,
    el,
    enter() {
      unsub = lab.subscribe(liveUpdate);
      if (exp) lab.setFlags(entry === 'manual' ? { hideReadout: true, aidsAllowed: false, revealingOpen: false, hideAriaReading: true } : { ...EXPLORE_FLAGS, revealingOpen: false });
      render();
    },
    exit() {
      unsub?.();
      lab.setFlags(EXPLORE_FLAGS);
    },
    /** Automation hook: the current experiment data. */
    data: () => exp,
  };
}

// ── Print sheet (A4, SPEC §8.3) ─────────────────────────────────────────────

export function fillPrintSheet(exp: Experiment): HTMLElement {
  let sheet = document.getElementById('print-sheet');
  if (!sheet) {
    sheet = h('section', { id: 'print-sheet', 'aria-hidden': 'true' });
    document.body.append(sheet);
  }
  const p = printSheet(exp);
  const dl = (k: string, v: string) => h('div', { class: 'ps-row' }, [h('strong', {}, [`${k}: `]), v]);
  sheet.replaceChildren(
    h('header', { class: 'ps-header' }, [p.header]),
    h('h1', {}, [p.title]),
    dl(t.exAim, p.aim),
    dl(t.exApparatus, p.apparatus),
    dl(t.exLc, p.lc),
    dl(t.exZe, p.ze),
    ...p.tables.flatMap((tb) => [
      renderTable(tb.head, tb.rows, tb.caption),
      h('h2', {}, [`${t.exCalc}: ${tb.caption.replace('Observations: ', '')}`]),
      renderWorkingsFlat(tb.workings),
    ]),
    ...(p.derived ? [h('h2', {}, [p.derived.name]), renderWorkingsFlat(p.derived.steps)] : []),
    h('h2', {}, [t.exResult]),
    h('ul', { class: 'ps-result' }, p.result.map((r) => h('li', {}, [r]))),
    h('h2', {}, [t.exPrecautions]),
    h('ol', {}, p.precautions.map((r) => h('li', {}, [r]))),
  );
  return sheet;
}
