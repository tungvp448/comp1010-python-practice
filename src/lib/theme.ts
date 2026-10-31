/**
 * Per-viewer colour theme. 'auto' follows the OS (prefers-color-scheme); 'light'/'dark' force it
 * via <html data-theme>. index.html applies the saved value before first paint.
 */
export type Theme = 'auto' | 'light' | 'dark';
export const THEME_KEY = 'comp1010.theme';

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    if (theme === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage unavailable: the choice still applies for this page view.
  }
}
