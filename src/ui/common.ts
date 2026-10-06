/**
 * Settings controls shared by both instrument pages: session seed, zero-error
 * mode, theme, sound and haptics.
 */
import { codeToSeed, normaliseSeed, seedToCode } from '../core/rng';
import type { ZeroErrorMode, ZeroErrorSettings } from '../core/zeroCommon';
import { setHapticsEnabled, setSoundEnabled } from '../audio/sfx';
import { h, iconButton, segmented, select, toggle } from './controls';
import { icons } from './icons';
import { t } from './i18n';
import { applyTheme, loadPrefs, savePrefs, type Theme } from './prefs';
import { flashStatus } from './shell';

export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return normaliseSeed(a[0]!);
}

/** Zero-error settings from URL parameters (?ze=custom&zeDiv=3&zeSign=-). */
export function zeroFromQuery(q: URLSearchParams): ZeroErrorSettings | null {
  const ze = q.get('ze');
  const modes: Record<string, ZeroErrorMode> = { none: 'none', pos: 'positive', neg: 'negative', rand: 'random', custom: 'custom' };
  if (!ze || !(ze in modes)) return null;
  return { mode: modes[ze]!, custom: { divisions: Number(q.get('zeDiv') ?? 3), sign: q.get('zeSign') === '-' ? -1 : 1 } };
}

export interface Synced<T> {
  el: HTMLElement;
  sync(v: T): void;
}

export function seedControls(get: () => number, apply: (seed: number) => void, status: HTMLElement): Synced<number> {
  const input = h('input', { type: 'text', id: 'seed-input', value: seedToCode(get()), spellcheck: 'false', autocomplete: 'off', class: 'seed-input' });
  const copy = iconButton(icons.copy, t.sSeedCopy, async () => {
    try {
      await navigator.clipboard.writeText(seedToCode(get()));
      flashStatus(status, `${t.sSeedCopied}: ${seedToCode(get())}`);
    } catch {
      input.select();
    }
  });
  const use = h('button', { type: 'button', class: 'btn' }, [t.sSeedApply]);
  use.addEventListener('click', () => apply(codeToSeed(input.value)));
  input.addEventListener('keydown', (e) => e.key === 'Enter' && apply(codeToSeed(input.value)));
  const dice = iconButton(icons.dice, t.sSeedRandom, () => apply(randomSeed()));
  const el = h('div', { class: 'field' }, [
    h('label', { for: 'seed-input' }, [t.sSeed]),
    h('div', { class: 'seed-row' }, [input, use, copy, dice]),
    h('p', { class: 'hint' }, [t.sSeedHelp]),
  ]);
  return {
    el,
    sync(seed) {
      if (document.activeElement !== input) input.value = seedToCode(seed);
    },
  };
}

export function zeroControls(get: () => ZeroErrorSettings, set: (z: ZeroErrorSettings) => void, maxDivisions: number): Synced<ZeroErrorSettings> & { setDisabled(d: boolean): void } {
  const modeSel = select<ZeroErrorMode>(
    t.sZeMode,
    [
      { value: 'none', label: t.sZeNone },
      { value: 'positive', label: t.sZePos },
      { value: 'negative', label: t.sZeNeg },
      { value: 'random', label: t.sZeRand },
      { value: 'custom', label: t.sZeCustom },
    ],
    get().mode,
    (mode) => set({ ...get(), mode }),
  );
  const div = h('input', { type: 'number', min: 0, max: maxDivisions, step: 1, id: 'ze-div', value: get().custom?.divisions ?? 3 });
  const sign = segmented<'+' | '-'>(t.sZeSign, [{ value: '+', label: '+' }, { value: '-', label: '−' }], get().custom?.sign === -1 ? '-' : '+', (v) =>
    set({ ...get(), custom: { divisions: Number(div.value) || 0, sign: v === '-' ? -1 : 1 } }),
  );
  div.addEventListener('change', () =>
    set({ ...get(), custom: { divisions: Math.max(0, Math.min(maxDivisions, Math.round(Number(div.value) || 0))), sign: get().custom?.sign ?? 1 } }),
  );
  const custom = h('div', { class: 'field-group' }, [h('div', { class: 'field' }, [h('label', { for: 'ze-div' }, [t.sZeDivisions]), div]), sign.el]);
  const el = h('div', {}, [modeSel.el, custom]);
  return {
    el,
    sync(z) {
      modeSel.set(z.mode);
      custom.hidden = z.mode !== 'custom';
    },
    setDisabled(d) {
      modeSel.input.disabled = d;
      div.disabled = d;
    },
  };
}

/** Theme, sound and haptics. Saved for every page on this laptop. */
export function prefsControls(onTheme: (th: Theme) => void): Synced<Theme> {
  const prefs = loadPrefs();
  setSoundEnabled(prefs.sound);
  setHapticsEnabled(prefs.haptics);
  const theme = segmented<Theme>(
    t.sTheme,
    [
      { value: 'light', label: t.themeLight },
      { value: 'dark', label: t.themeDark },
      { value: 'contrast', label: t.themeContrast },
    ],
    prefs.theme,
    (v) => {
      savePrefs({ theme: v });
      applyTheme(v);
      onTheme(v);
    },
  );
  const sound = toggle(t.sSound, prefs.sound, (on) => {
    savePrefs({ sound: on });
    setSoundEnabled(on);
  });
  const haptics = toggle(t.sHaptics, prefs.haptics, (on) => {
    savePrefs({ haptics: on });
    setHapticsEnabled(on);
  });
  return { el: h('div', {}, [theme.el, sound.el, haptics.el]), sync: (v) => theme.set(v) };
}
