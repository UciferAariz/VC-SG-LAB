/** Small, accessible form controls (vanilla DOM). */

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | null | undefined> = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/**
 * True when keys typed at this element are text (so page shortcuts must not
 * fire): text boxes, number boxes, selects (type-ahead), textareas, editable
 * content. Radios, checkboxes and buttons are not typing targets.
 */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest('textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
  if (el instanceof HTMLInputElement) return !['radio', 'checkbox', 'button', 'submit', 'reset', 'range', 'color'].includes(el.type);
  return false;
}

let idCounter = 0;
export function uid(prefix = 'c'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Icon button with an accessible label (and optional visible text). */
export function iconButton(icon: string, label: string, onClick: () => void, opts: { text?: string; cls?: string } = {}): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `btn ${opts.cls ?? ''}`.trim(), 'aria-label': label, title: label });
  b.innerHTML = icon;
  if (opts.text) b.append(h('span', { class: 'btn-text' }, [opts.text]));
  b.addEventListener('click', onClick);
  return b;
}

export interface Segmented<T extends string> {
  el: HTMLElement;
  set(value: T): void;
}

/** Radio-group styled as a segmented control. */
export function segmented<T extends string>(label: string, options: { value: T; label: string }[], value: T, onChange: (v: T) => void): Segmented<T> {
  const name = uid('seg');
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const inputs: HTMLInputElement[] = [];
  for (const o of options) {
    const id = uid('opt');
    const input = h('input', { type: 'radio', name, id, value: o.value });
    input.checked = o.value === value;
    input.addEventListener('change', () => input.checked && onChange(o.value));
    inputs.push(input);
    group.append(input, h('label', { for: id }, [o.label]));
  }
  return {
    el: field(label, group, true),
    set(v) {
      for (const i of inputs) i.checked = i.value === v;
    },
  };
}

export interface Toggle {
  el: HTMLElement;
  set(on: boolean): void;
}

export function toggle(label: string, on: boolean, onChange: (on: boolean) => void): Toggle {
  const id = uid('tg');
  const input = h('input', { type: 'checkbox', id, role: 'switch', class: 'switch' });
  input.checked = on;
  input.addEventListener('change', () => onChange(input.checked));
  const el = h('div', { class: 'field field-row' }, [h('label', { for: id }, [label]), input]);
  return { el, set: (v) => (input.checked = v) };
}

export interface Select<T extends string> {
  el: HTMLElement;
  input: HTMLSelectElement;
  set(value: T): void;
}

export function select<T extends string>(label: string, options: { value: T; label: string }[], value: T, onChange: (v: T) => void): Select<T> {
  const id = uid('sel');
  const input = h('select', { id });
  for (const o of options) {
    const opt = h('option', { value: o.value }, [o.label]);
    opt.selected = o.value === value;
    input.append(opt);
  }
  input.addEventListener('change', () => onChange(input.value as T));
  const el = h('div', { class: 'field' }, [h('label', { for: id }, [label]), input]);
  return { el, input, set: (v) => (input.value = v) };
}

/** Labelled wrapper. `group` uses a <fieldset>-like role for radio groups. */
export function field(label: string, control: HTMLElement, group = false): HTMLElement {
  if (group) return h('div', { class: 'field' }, [h('div', { class: 'field-label', 'aria-hidden': 'true' }, [label]), control]);
  return h('div', { class: 'field' }, [h('span', { class: 'field-label' }, [label]), control]);
}

/**
 * Button that fires on press and auto-repeats while held (SPEC §5.7):
 * 350 ms delay, then every 50 ms, speeding up after 1.2 s.
 */
export function holdButton(icon: string, label: string, onStep: (accelerated: boolean) => void, cls = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `btn btn-hold ${cls}`.trim(), 'aria-label': label, title: label });
  b.innerHTML = icon;
  let timer: number | undefined;
  let started = 0;
  const stop = () => {
    window.clearTimeout(timer);
    timer = undefined;
  };
  const tick = () => {
    onStep(performance.now() - started > 1200);
    timer = window.setTimeout(tick, 50);
  };
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    started = performance.now();
    onStep(false);
    timer = window.setTimeout(tick, 350);
  });
  b.addEventListener('pointerup', stop);
  b.addEventListener('pointercancel', stop);
  b.addEventListener('lostpointercapture', stop);
  // Keyboard activation: one step per press (key repeat handles holding).
  b.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onStep(false);
    }
  });
  return b;
}

/** Tabs with proper ARIA roles and arrow-key navigation. */
export function tabs(items: { id: string; label: string; panel: HTMLElement }[], initial = 0): { el: HTMLElement; select(i: number): void } {
  const list = h('div', { class: 'tablist', role: 'tablist' });
  const panels = h('div', { class: 'tabpanels' });
  const buttons: HTMLButtonElement[] = [];
  const selectTab = (i: number, focus = false) => {
    items.forEach((it, j) => {
      const on = i === j;
      buttons[j]!.setAttribute('aria-selected', String(on));
      buttons[j]!.tabIndex = on ? 0 : -1;
      it.panel.hidden = !on;
    });
    if (focus) buttons[i]!.focus();
  };
  items.forEach((it, i) => {
    const tabId = uid('tab');
    const panelId = uid('panel');
    const b = h('button', { type: 'button', role: 'tab', id: tabId, 'aria-controls': panelId, class: 'tab' }, [it.label]);
    b.addEventListener('click', () => selectTab(i));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const n = (i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length;
        selectTab(n, true);
      }
    });
    buttons.push(b);
    list.append(b);
    it.panel.id = panelId;
    it.panel.setAttribute('role', 'tabpanel');
    it.panel.setAttribute('aria-labelledby', tabId);
    it.panel.classList.add('tabpanel');
    panels.append(it.panel);
  });
  selectTab(initial);
  return { el: h('div', { class: 'tabs' }, [list, panels]), select: (i) => selectTab(i) };
}

/** ⓘ button with a one-sentence tooltip, reachable by keyboard. */
export function infoTip(text: string): HTMLElement {
  const id = uid('tip');
  const btn = h('button', { type: 'button', class: 'info-btn', 'aria-describedby': id, 'aria-label': 'More information' });
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  return h('span', { class: 'info' }, [btn, h('span', { class: 'tooltip', role: 'tooltip', id }, [text])]);
}
