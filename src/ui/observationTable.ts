/** Observation table and working-line rendering, shared by the panel and the print sheet. */
import { h } from './controls';
import type { WorkingLine } from './errorWorkings';

export function renderTable(head: string[], rows: string[][], caption?: string, emptyText = ''): HTMLTableElement {
  const table = h('table', { class: 'obs-table' });
  if (caption) table.append(h('caption', {}, [caption]));
  table.append(h('thead', {}, [h('tr', {}, head.map((c) => h('th', { scope: 'col' }, [c])))]));
  const body = h('tbody');
  for (const r of rows) body.append(h('tr', {}, r.map((c) => h('td', {}, [c]))));
  if (rows.length === 0 && emptyText) body.append(h('tr', {}, [h('td', { colspan: head.length, class: 'empty' }, [emptyText])]));
  table.append(body);
  return table;
}

/** Working lines as expandable <details> (symbols first, then numbers). */
export function renderWorkings(lines: WorkingLine[], open = false): HTMLElement {
  const box = h('div', { class: 'workings' });
  lines.forEach((w, i) => {
    const last = i === lines.length - 1;
    const d = h('details', { class: last ? 'working final' : 'working', open: open || last }, [
      h('summary', {}, [w.title]),
      h('p', { class: 'symbolic' }, [w.symbolic]),
      h('p', { class: 'numeric' }, [w.numeric]),
    ]);
    box.append(d);
  });
  return box;
}

/** Working lines as plain paragraphs (print). */
export function renderWorkingsFlat(lines: WorkingLine[]): HTMLElement {
  return h(
    'ol',
    { class: 'workings-flat' },
    lines.map((w) => h('li', {}, [h('strong', {}, [`${w.title}: `]), h('span', { class: 'symbolic' }, [w.symbolic]), h('br'), h('span', {}, [w.numeric])])),
  );
}
