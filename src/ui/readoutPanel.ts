/**
 * Live readout (SPEC §8.1). Every value is formatted from core/ results with
 * the decimals the least count justifies. An aria-live region announces the
 * reading, throttled so screen readers are not flooded while dragging.
 */
import { formatFixed } from '../core/sigfig';
import { formatLength, formatSignedLength, toUnit, type LengthUnit } from '../core/units';
import { h, infoTip } from './controls';
import { t } from './i18n';

export interface ReadoutRow {
  key: string;
  label: string;
  tip: string;
  emphasis?: boolean;
}

export interface ReadoutValues {
  [key: string]: string;
}

export interface Readout {
  el: HTMLElement;
  set(values: ReadoutValues, announce: string): void;
  setVisible(key: string, visible: boolean): void;
}

export function createReadout(rows: ReadoutRow[], footnote: string): Readout {
  const table = h('dl', { class: 'readout' });
  const cells = new Map<string, { row: HTMLElement; value: HTMLElement }>();
  for (const r of rows) {
    const value = h('dd', { class: 'readout-value' });
    const row = h('div', { class: `readout-row${r.emphasis ? ' emphasis' : ''}`, 'data-key': r.key }, [
      h('dt', {}, [h('span', {}, [r.label]), infoTip(r.tip)]),
      value,
    ]);
    cells.set(r.key, { row, value });
    table.append(row);
  }
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const el = h('section', { class: 'readout-panel', 'aria-label': t.tabReadout }, [table, h('p', { class: 'formula' }, [footnote]), live]);

  let lastAnnounce = '';
  let timer: number | undefined;
  let pending = '';

  return {
    el,
    set(values, announce) {
      for (const [k, v] of Object.entries(values)) {
        const c = cells.get(k);
        if (c && c.value.textContent !== v) c.value.textContent = v;
      }
      pending = announce;
      if (timer === undefined) {
        timer = window.setTimeout(() => {
          timer = undefined;
          if (pending !== lastAnnounce) {
            live.textContent = pending;
            lastAnnounce = pending;
          }
        }, 700);
      }
    },
    setVisible(key, visible) {
      const c = cells.get(key);
      if (c) c.row.hidden = !visible;
    },
  };
}

/** Helpers shared by both instruments. */
/** Typographic minus for display (U+2212). */
export function minus(s: string): string {
  return s.replace(/^-/, '−');
}

export function fmtLen(mm: number, unit: LengthUnit, lc: number): string {
  return `${minus(formatLength(mm, unit, lc))} ${unit}`;
}

export function fmtSigned(mm: number, unit: LengthUnit, lc: number): string {
  return `${formatSignedLength(mm, unit, lc)} ${unit}`;
}

export function fmtTrue(mm: number, unit: LengthUnit): string {
  return `${minus(formatFixed(toUnit(mm, unit), 6))} ${unit}`;
}
