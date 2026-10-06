/**
 * Step-by-step error-analysis working (SPEC §7, §8.3 step 4). Builds the
 * lines shown in the Experiment panel, the print sheet and the CSV from a
 * core/errors analysis. Working values carry two more decimals than the least
 * count; the final result is rounded to the LC's decimal place (SPEC §7.2).
 */
import { formatResult, formatSig, type ErrorAnalysis } from '../core/errors';
import { formatFixed } from '../core/sigfig';

export interface WorkingLine {
  title: string;
  symbolic: string;
  numeric: string;
}

const m = (s: string) => s.replace(/(^|[\s(=])-(?=\d)/g, '$1−');

export function errorWorkings(a: ErrorAnalysis, symbol: string, unit: string): WorkingLine[] {
  const d = a.decimals;
  const w = (x: number) => m(formatFixed(x, d + 2));
  const r = (x: number) => m(formatFixed(x, d));
  const readings = a.readings.map(r);
  const lines: WorkingLine[] = [
    {
      title: 'Mean value',
      symbolic: `${symbol}̄ = (${symbol}₁ + ${symbol}₂ + … + ${symbol}ₙ) / n`,
      numeric: `${symbol}̄ = (${readings.join(' + ')}) / ${a.n} = ${w(a.mean)} ${unit}`,
    },
    {
      title: 'Absolute error of each reading',
      symbolic: `|Δ${symbol}ᵢ| = |${symbol}̄ − ${symbol}ᵢ|`,
      numeric: a.absErrors.map((e, i) => `|Δ${symbol}${sub(i + 1)}| = ${w(e)}`).join(',  ') + ` ${unit}`,
    },
    {
      title: 'Mean absolute error',
      symbolic: `Δ${symbol}̄ = Σ|Δ${symbol}ᵢ| / n`,
      numeric: `Δ${symbol}̄ = (${a.absErrors.map(w).join(' + ')}) / ${a.n} = ${w(a.meanAbsError)} ${unit}`,
    },
    {
      title: 'Relative error',
      symbolic: `δ${symbol} = Δ${symbol}̄ / ${symbol}̄`,
      numeric: `δ${symbol} = ${w(a.meanAbsError)} / ${w(a.mean)} = ${formatSig(a.relativeError, 4)}`,
    },
    {
      title: 'Percentage error',
      symbolic: `δ${symbol} × 100 %`,
      numeric: `${formatSig(a.percentError, 3)} %`,
    },
    {
      title: 'Reporting rule',
      symbolic: `Δ${symbol} = max(Δ${symbol}̄, LC), rounded to the LC's decimal place; ${symbol}̄ rounded to the same place`,
      numeric: a.usedLeastCount
        ? `Δ${symbol}̄ = ${w(a.meanAbsError)} is smaller than LC = ${r(a.lc)}, so the uncertainty is the least count: Δ${symbol} = ${r(a.reportedError)} ${unit}`
        : `Δ${symbol}̄ = ${w(a.meanAbsError)} ≥ LC = ${r(a.lc)}, so Δ${symbol} = ${r(a.reportedError)} ${unit}`,
    },
    {
      title: 'Result',
      symbolic: `${symbol} = (${symbol}̄ ± Δ${symbol}) ${unit}`,
      numeric: m(formatResult(symbol, a.reportedMean, a.reportedError, d, unit)),
    },
  ];
  return lines;
}

/** Optional (beyond NCERT): sample standard deviation. */
export function stdDevLine(a: ErrorAnalysis, symbol: string, unit: string): WorkingLine {
  return {
    title: 'Standard deviation (beyond NCERT scope)',
    symbolic: `σ = √( Σ(${symbol}ᵢ − ${symbol}̄)² / (n − 1) )`,
    numeric: `σ = ${formatSig(a.stdDev, 3)} ${unit}`,
  };
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
function sub(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUB[Number(c)])
    .join('');
}
