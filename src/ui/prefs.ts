/**
 * Display preferences shared by every page (theme, sound, haptics, magnifier).
 * Kept in localStorage on this laptop only — no cookies, nothing leaves the
 * machine. Every access is guarded: a blocked or full storage just means the
 * defaults are used.
 */

export type Theme = 'light' | 'dark' | 'contrast';

export interface Prefs {
  theme: Theme;
  sound: boolean;
  haptics: boolean;
  /** Magnifier shown when an instrument page opens. */
  loupe: boolean;
}

const KEY = 'rizlab.prefs.v1';
const DEFAULTS: Prefs = { theme: 'light', sound: true, haptics: true, loupe: true };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: p.theme === 'dark' || p.theme === 'contrast' || p.theme === 'light' ? p.theme : DEFAULTS.theme,
      sound: typeof p.sound === 'boolean' ? p.sound : DEFAULTS.sound,
      haptics: typeof p.haptics === 'boolean' ? p.haptics : DEFAULTS.haptics,
      loupe: typeof p.loupe === 'boolean' ? p.loupe : DEFAULTS.loupe,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(patch: Partial<Prefs>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch {
    /* storage unavailable: preferences last for this page only */
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
