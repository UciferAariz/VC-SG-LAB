/**
 * The Mode tab (SPEC §8): Explore (default), Practice, Experiment, the guided
 * least-count / pitch activity, and the Presentation toggle. Switching mode
 * calls exit() on the old one and enter() on the new one; each mode sets the
 * page flags it needs (hidden readout, no highlight aids …) through the adapter.
 */
import { createExperimentMode } from './experimentMode';
import { createGuidedScrew, createGuidedVernier } from './guidedMode';
import { createPracticeMode } from './practiceMode';
import { h } from './controls';
import { t } from './i18n';
import { EXPLORE_FLAGS, type LabAdapter } from './lab';

export interface Mode {
  id: string;
  title: string;
  desc: string;
  el: HTMLElement;
  enter(): void;
  exit(): void;
  /** Automation hooks (screenshot / smoke scripts). */
  step?(): string;
  data?(): unknown;
}

export interface ModeTab {
  el: HTMLElement;
  select(id: string): void;
  current(): string;
  modes: Mode[];
}

export function createModeTab(lab: LabAdapter, opts: { onPresent?: () => void } = {}): ModeTab {
  const explore: Mode = { id: 'explore', title: t.modeExplore, desc: t.modeExploreDesc, el: h('div'), enter: () => lab.setFlags(EXPLORE_FLAGS), exit: () => undefined };
  const modes: Mode[] = [explore, createPracticeMode(lab), createExperimentMode(lab), lab.instrument === 'vernier' ? createGuidedVernier(lab) : createGuidedScrew(lab)];
  let current = explore;
  const list = h('div', { class: 'mode-list', role: 'group', 'aria-label': t.tabMode });
  const panel = h('div', { class: 'mode-host' });
  const cards = new Map<string, HTMLButtonElement>();
  for (const m of modes) {
    const card = h('button', { type: 'button', class: 'mode-card', 'aria-pressed': 'false', 'data-mode': m.id }, [h('strong', {}, [m.title]), h('span', {}, [m.desc])]);
    card.addEventListener('click', () => select(m.id));
    cards.set(m.id, card);
    list.append(card);
  }
  if (opts.onPresent) {
    const present = h('button', { type: 'button', class: 'mode-card', 'data-mode': 'presentation' }, [h('strong', {}, [t.modePresentation]), h('span', {}, [t.modePresentationDesc])]);
    present.addEventListener('click', () => opts.onPresent!());
    list.append(present);
  }

  function select(id: string): void {
    const next = modes.find((m) => m.id === id) ?? explore;
    if (next !== current) {
      current.exit();
      current = next;
      current.enter();
    }
    // With a mode running, the cards shrink to a row of chips so its panel is in view.
    list.classList.toggle('compact', current.id !== 'explore');
    for (const [mid, c] of cards) {
      c.classList.toggle('active', mid === current.id);
      c.setAttribute('aria-pressed', String(mid === current.id));
    }
    panel.replaceChildren(current.el);
  }
  select('explore');
  return { el: h('div', {}, [list, panel]), select, current: () => current.id, modes };
}
