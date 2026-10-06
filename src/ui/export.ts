/**
 * Experiment exports (SPEC §8.3): CSV, a plain-text result summary, and the
 * content of the A4 practical-file sheet. Pure — the DOM side lives in
 * experimentMode.ts.
 */
import { formatResult, formatSig } from '../core/errors';
import { formatLength } from '../core/units';
import { analyse, derivedResult, tableColumns, type Experiment, type QuantityRecord } from './experimentModel';
import { errorWorkings, type WorkingLine } from './errorWorkings';

const BRAND = 'Riz Lab';

function signed(mm: number, exp: Experiment): string {
  const s = formatLength(Math.abs(mm), exp.unit, exp.lcMm);
  if (Number(s) === 0) return `${s} ${exp.unit}`;
  return `${mm < 0 ? '−' : '+'}${s} ${exp.unit}`;
}

export function instrumentName(exp: Experiment): string {
  return exp.instrument === 'vernier' ? 'Vernier callipers' : 'Screw gauge';
}

export function lcText(exp: Experiment): string {
  const mm = `${formatLength(exp.lcMm, 'mm', exp.lcMm)} mm`;
  const lc = exp.unit === 'mm' ? mm : `${mm} = ${formatLength(exp.lcMm, exp.unit, exp.lcMm)} ${exp.unit}`;
  if (exp.instrument === 'vernier') {
    const span = (exp.gamma ?? 1) * exp.N - 1;
    return `${exp.N} VSD = ${span} MSD, LC = MSD / N = 1 mm / ${exp.N} = ${lc}`;
  }
  const pitch = formatLength(exp.pitchMm ?? 0.5, 'mm', 0.1);
  return `Pitch = ${pitch} mm, N = ${exp.N}, LC = pitch / N = ${pitch} mm / ${exp.N} = ${lc}`;
}

export function zeText(exp: Experiment): string {
  const z = exp.ze;
  if (!z) return 'not recorded';
  if (z.kind === 'none') return `0 (no zero error); zero correction = 0`;
  const lc = `${formatLength(z.lcMm, exp.unit, z.lcMm)} ${exp.unit}`;
  const rule = z.kind === 'positive' ? `+${z.n} × ${lc}` : `−(${z.N} − ${z.n}) × ${lc}`;
  return `${signed(z.zeMm, exp)}  (n = ${z.n}: ${rule}); zero correction = ${signed(-z.zeMm, exp)}`;
}

export function resultText(exp: Experiment, q: QuantityRecord): string | null {
  const a = analyse(exp, q);
  if (!a) return null;
  return formatResult(q.symbol, a.reportedMean, a.reportedError, a.decimals, exp.unit).replace(/(^|[\s(])-(?=\d)/g, '$1−');
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV of the observation tables plus results (UTF-8; Excel reads the BOM). */
export function buildCsv(exp: Experiment): string {
  const lines: string[][] = [];
  lines.push([BRAND]);
  lines.push([`Experiment: ${instrumentName(exp)}`, `Object: ${exp.objectLabel}`]);
  lines.push(['Least count', lcText(exp)]);
  lines.push(['Zero error', zeText(exp)]);
  lines.push([]);
  for (const q of exp.quantities) {
    if (q.rows.length === 0) continue;
    lines.push([`${q.dimLabel} (${q.symbol})`]);
    const t = tableColumns(exp, q);
    lines.push(t.head, ...t.rows);
    const a = analyse(exp, q);
    if (a) {
      for (const w of errorWorkings(a, q.symbol, exp.unit)) lines.push([w.title, w.numeric]);
    }
    lines.push([]);
  }
  const dr = derivedResult(exp);
  if (dr) {
    lines.push([dr.name]);
    for (const s of dr.steps) lines.push([s.label, s.numeric]);
    lines.push(['Result', dr.resultText]);
  }
  return '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Plain-text summary for "Copy result". */
export function resultSummary(exp: Experiment): string {
  const out: string[] = [`${BRAND}: ${instrumentName(exp)}, ${exp.objectLabel}`, `LC: ${lcText(exp)}`, `Zero error: ${zeText(exp)}`];
  for (const q of exp.quantities) {
    const r = resultText(exp, q);
    if (!r) continue;
    const a = analyse(exp, q)!;
    out.push(`${q.dimLabel}: ${r}  (n = ${a.n}, mean absolute error ${formatSig(a.meanAbsError, 3)} ${exp.unit}, percentage error ${formatSig(a.percentError, 3)} %)`);
  }
  const dr = derivedResult(exp);
  if (dr) out.push(`${dr.name}: ${dr.resultText}  (percentage error ${formatSig(dr.percentError, 3)} %)`);
  return out.join('\n');
}

export interface PrintSheet {
  header: string;
  title: string;
  aim: string;
  apparatus: string;
  lc: string;
  ze: string;
  tables: { caption: string; head: string[]; rows: string[][]; workings: WorkingLine[]; result: string | null }[];
  derived: { name: string; steps: WorkingLine[]; result: string } | null;
  result: string[];
  precautions: string[];
}

const PRECAUTIONS: Record<Experiment['instrument'], string[]> = {
  vernier: [
    'The zero error was noted with the jaws closed and the correction applied with its sign (corrected = observed − zero error).',
    'The object was held gently between the jaws: they just touched it without pressing.',
    'The slider was locked with the locking screw before each reading.',
    'The scales were read with the eye directly above the coinciding lines, to avoid parallax.',
    'Readings were taken at different positions / orientations of the object and their mean was used.',
  ],
  screw: [
    'The screw was always turned with the ratchet, so the object was never squashed.',
    'The final approach was always made in the same direction, to avoid backlash error.',
    'The zero error was noted with the faces just touching (ratchet clicking) and the correction applied with its sign.',
    'Readings were taken at several points and, for a wire, in two perpendicular directions at each point.',
    'The scales were read with the eye perpendicular to the datum line, to avoid parallax.',
  ],
};

const APPARATUS: Record<string, string> = {
  bob: 'Vernier callipers, a spherical pendulum bob',
  cylinder: 'Vernier callipers, a solid cylinder',
  beaker: 'Vernier callipers, a beaker / calorimeter',
  block: 'Vernier callipers, a rectangular block',
  wire: 'Screw gauge, a piece of copper wire',
  sheet: 'Screw gauge, a metal sheet / coin',
  slide: 'Screw gauge, a glass slide',
  ball: 'Screw gauge, a steel ball bearing',
  paper: 'Screw gauge, a stack of paper',
};

export function printSheet(exp: Experiment): PrintSheet {
  const tables = exp.quantities
    .filter((q) => q.rows.length > 0)
    .map((q) => {
      const t = tableColumns(exp, q);
      const a = analyse(exp, q);
      return { caption: `Observations: ${q.dimLabel} (${q.symbol})`, head: t.head, rows: t.rows, workings: a ? errorWorkings(a, q.symbol, exp.unit) : [], result: resultText(exp, q) };
    });
  const dr = derivedResult(exp);
  const result = tables.filter((t) => t.result).map((t) => `${t.caption.replace('Observations: ', '')}: ${t.result}`);
  if (dr) result.push(`${dr.name}: ${dr.resultText}`);
  return {
    header: BRAND,
    title: `${instrumentName(exp)}: ${exp.objectLabel}`,
    aim: `To measure ${exp.aimNoun} using a ${instrumentName(exp).toLowerCase()}.`,
    apparatus: APPARATUS[exp.objectKind] ?? instrumentName(exp),
    lc: lcText(exp),
    ze: zeText(exp),
    tables,
    derived: dr ? { name: dr.name, steps: dr.steps.map((s) => ({ title: s.label, symbolic: s.symbolic, numeric: s.numeric })), result: dr.resultText } : null,
    result,
    precautions: PRECAUTIONS[exp.instrument],
  };
}
