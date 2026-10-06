/**
 * Presentation / demo mode for classroom projection (SPEC §8.5).
 *
 *  - High-contrast theme, text ≥ 24 px, readout docked large on the right,
 *    thicker engraving and bold coincidence highlights.
 *  - A scripted auto-demo: each step sets the instrument up from scratch
 *    (so Back works) and then shows a caption built from core/ values.
 *  - Clicker keys: Space / → / PageDown = next, Backspace / ← / PageUp = back;
 *    P toggles the mode. The cursor hides after 3 s without movement.
 *  - Fullscreen button (Fullscreen API).
 */
import { h, iconButton, isTypingTarget } from './controls';
import { icons } from './icons';
import { t } from './i18n';
import type { LabAdapter } from './lab';
import { applyTheme, loadPrefs, type Theme } from './prefs';

export interface DemoStep {
  title: string;
  /** Put the instrument in the state for this step (absolute, so Back works). */
  run(lab: LabAdapter): Promise<void> | void;
  /** Caption, computed after run() so it shows the instrument's real values. */
  caption(lab: LabAdapter): string;
}

export interface Presentation {
  toggle(): void;
  active(): boolean;
  go(i: number): Promise<void>;
  index(): number;
}

export function createPresentation(lab: LabAdapter, stage: HTMLElement, script: DemoStep[], hooks: { beforeEnter?(): void; theme(th: Theme): void }): Presentation {
  let on = false;
  let i = 0;
  /** The step most recently asked for (updated at once, so fast clicker presses add up). */
  let wanted = 0;
  let busy = Promise.resolve();
  let cursorTimer = 0;
  let savedTheme: Theme = loadPrefs().theme;

  const title = h('h2', { class: 'demo-title' });
  const caption = h('p', { class: 'demo-caption', 'aria-live': 'polite' });
  const counter = h('span', { class: 'demo-counter' });
  const prev = iconButton(icons.prev, t.pPrev, () => void go(wanted - 1), { cls: 'btn-demo' });
  const next = iconButton(icons.next, t.pNext, () => void go(wanted + 1), { cls: 'btn-demo' });
  const full = iconButton(icons.fullscreen, t.pFullscreen, () => toggleFullscreen(), { cls: 'btn-demo' });
  const exit = iconButton(icons.close, t.pExit, () => toggle(), { cls: 'btn-demo' });
  const bar = h('section', { class: 'demo-bar', 'aria-label': t.pTitle, hidden: true }, [
    h('div', { class: 'demo-text' }, [title, caption]),
    h('div', { class: 'demo-controls' }, [counter, prev, next, full, exit]),
  ]);
  stage.append(bar);
  // The drawing area ends above the caption bar, so nothing is hidden behind it.
  new ResizeObserver(() => stage.style.setProperty('--demo-h', `${bar.offsetHeight}px`)).observe(bar);

  function toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  async function go(n: number): Promise<void> {
    const target = Math.max(0, Math.min(script.length - 1, n));
    wanted = target;
    // Queue steps so fast clicker presses don't interleave animations; a step
    // that has been superseded by a later press is skipped.
    busy = busy.then(async () => {
      if (target !== wanted) return;
      i = target;
      const step = script[i]!;
      title.textContent = step.title;
      caption.textContent = '…';
      counter.textContent = t.pStep(i + 1, script.length);
      prev.disabled = i === 0;
      next.disabled = i === script.length - 1;
      await step.run(lab);
      caption.textContent = step.caption(lab);
    });
    return busy;
  }

  function showCursor(): void {
    document.body.classList.remove('cursor-hidden');
    window.clearTimeout(cursorTimer);
    if (on) cursorTimer = window.setTimeout(() => document.body.classList.add('cursor-hidden'), 3000);
  }

  function onKey(e: KeyboardEvent): void {
    if (isTypingTarget(e.target as Element)) return;
    if (e.key === 'p' || e.key === 'P') {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      toggle();
      return;
    }
    if (!on) return;
    if ([' ', 'ArrowRight', 'PageDown'].includes(e.key)) {
      e.preventDefault();
      void go(wanted + 1);
    } else if (['Backspace', 'ArrowLeft', 'PageUp'].includes(e.key)) {
      e.preventDefault();
      void go(wanted - 1);
    }
  }
  // Capture phase: the clicker keys must win over the instrument's own keys.
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointermove', showCursor, { passive: true });

  function toggle(): void {
    on = !on;
    document.body.classList.toggle('presenting', on);
    bar.hidden = !on;
    lab.setBold(on);
    if (on) {
      savedTheme = (document.documentElement.dataset.theme as Theme) ?? loadPrefs().theme;
      hooks.beforeEnter?.();
      applyTheme('contrast');
      hooks.theme('contrast');
      showCursor();
      void go(0);
    } else {
      applyTheme(savedTheme);
      hooks.theme(savedTheme);
      document.body.classList.remove('cursor-hidden');
      window.clearTimeout(cursorTimer);
      if (document.fullscreenElement) void document.exitFullscreen();
    }
    // The stage changed size: let the viewport refit.
    window.dispatchEvent(new Event('resize'));
  }

  return { toggle, active: () => on, go, index: () => i };
}
