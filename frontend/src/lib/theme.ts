export type Theme = 'light' | 'dark';

const KEY = 'theme';

/** The user's explicitly chosen theme, or null if they've never picked one. */
export function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

/** The OS/browser preference, used when the user hasn't chosen a theme. */
export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Persist a choice and apply it to the document so every page reflects it. */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private mode etc - theme just won't persist
  }
}

/**
 * Apply the persisted theme once at startup so a fresh load of any page — even
 * ones without a visible toggle — honours the user's saved choice. Pages with
 * no stored choice inherit the system theme via CSS, so we leave the attribute
 * unset in that case.
 */
export function initTheme(): void {
  const t = storedTheme();
  if (t) document.documentElement.dataset.theme = t;
}
