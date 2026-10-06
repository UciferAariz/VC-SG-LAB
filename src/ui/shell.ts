/** Page chrome shared by the instrument pages: header, stage, side panel. */
import { h } from './controls';
import { t } from './i18n';

export interface Shell {
  stage: HTMLElement;
  panel: HTMLElement;
  toolbar: HTMLElement;
  dock: HTMLElement;
  status: HTMLElement;
}

export function createShell(pageTitle: string, current: 'vernier' | 'screw'): Shell {
  document.title = `${pageTitle} · ${t.brand}`;
  const nav = h('nav', { class: 'top-nav', 'aria-label': 'Pages' }, [
    h('a', { href: './index.html' }, [t.navHome]),
    h('a', { href: './vernier.html', 'aria-current': current === 'vernier' ? 'page' : null }, [t.vernierTitle]),
    h('a', { href: './screw-gauge.html', 'aria-current': current === 'screw' ? 'page' : null }, [t.screwTitle]),
    h('a', { href: './notes.html' }, [t.navNotes]),
  ]);
  const header = h('header', { class: 'app-header' }, [
    h('a', { class: 'brand', href: './index.html' }, [t.brand]),
    h('h1', { class: 'page-title' }, [pageTitle]),
    nav,
  ]);
  const toolbar = h('div', { class: 'stage-toolbar', role: 'toolbar', 'aria-label': 'View' });
  const dock = h('div', { class: 'stage-dock', role: 'toolbar', 'aria-label': 'Instrument controls' });
  const status = h('div', { class: 'stage-status', role: 'status' });
  const stage = h('div', { class: 'stage' }, [toolbar, dock, status]);
  const panel = h('aside', { class: 'side-panel', 'aria-label': 'Readout and settings', 'data-sheet': 'peek' });
  panel.append(sheetHandle(panel));
  const main = h('main', { class: 'workspace' }, [stage, panel]);
  const app = document.getElementById('app')!;
  app.replaceChildren(header, main);
  rotateHint(stage);
  return { stage, panel, toolbar, dock, status };
}

type SheetState = 'peek' | 'half' | 'full';
const SHEET_ORDER: SheetState[] = ['peek', 'half', 'full'];

/**
 * Phones (< 600 px): the panel is a bottom sheet with three snap heights
 * (SPEC §9.2). Drag the handle, or tap / press it to cycle. Hidden on larger
 * screens by CSS.
 */
function sheetHandle(panel: HTMLElement): HTMLButtonElement {
  const btn = h('button', { type: 'button', class: 'sheet-handle', 'aria-label': t.sheetHandle });
  btn.append(h('span', { class: 'sheet-grip', 'aria-hidden': 'true' }));
  const set = (st: SheetState) => {
    panel.dataset.sheet = st;
    panel.style.removeProperty('height');
    btn.setAttribute('aria-expanded', String(st !== 'peek'));
  };
  const heights = () => {
    const vh = window.innerHeight;
    return { peek: 104, half: vh * 0.5, full: vh * 0.88 } as Record<SheetState, number>;
  };
  let startY = 0;
  let startH = 0;
  let moved = false;
  btn.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    startH = panel.getBoundingClientRect().height;
    moved = false;
    btn.setPointerCapture(e.pointerId);
    panel.classList.add('dragging');
  });
  btn.addEventListener('pointermove', (e) => {
    if (!btn.hasPointerCapture(e.pointerId)) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 4) moved = true;
    if (moved) panel.style.height = `${Math.max(80, Math.min(window.innerHeight * 0.92, startH - dy))}px`;
  });
  const end = () => {
    panel.classList.remove('dragging');
    if (!moved) return;
    const hNow = panel.getBoundingClientRect().height;
    const hs = heights();
    set(SHEET_ORDER.reduce((best, st) => (Math.abs(hs[st] - hNow) < Math.abs(hs[best] - hNow) ? st : best), 'peek' as SheetState));
  };
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('click', () => {
    if (moved) return;
    const i = SHEET_ORDER.indexOf((panel.dataset.sheet as SheetState) ?? 'peek');
    set(SHEET_ORDER[(i + 1) % SHEET_ORDER.length]!);
  });
  // Choosing a tab while only peeking opens the sheet half-way.
  panel.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[role="tab"]') && panel.dataset.sheet === 'peek') set('half');
  });
  set('peek');
  return btn;
}

/** One-time, dismissible "rotate to landscape" hint on phones held upright. */
function rotateHint(stage: HTMLElement): void {
  const KEY = 'rizlab.rotateHint.v1';
  let seen = false;
  try {
    seen = localStorage.getItem(KEY) === '1';
  } catch {
    /* storage blocked: show it this time */
  }
  if (seen || !window.matchMedia('(max-width: 599px) and (orientation: portrait)').matches) return;
  const close = h('button', { type: 'button', class: 'btn btn-small' }, [t.dismiss]);
  const hint = h('div', { class: 'rotate-hint', role: 'note' }, [h('span', {}, [t.rotateHint]), close]);
  close.addEventListener('click', () => {
    hint.remove();
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
  });
  stage.append(hint);
}

export { applyTheme } from './prefs';

/** Brief message over the stage (e.g. "locked"). */
export function flashStatus(el: HTMLElement, text: string, ms = 1800): void {
  el.textContent = text;
  el.classList.add('visible');
  window.clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(window.setTimeout(() => el.classList.remove('visible'), ms));
}
