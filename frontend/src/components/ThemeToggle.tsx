import { useState } from 'react';
import { setTheme, storedTheme, systemTheme, type Theme } from '../lib/theme';

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme | null>(storedTheme);
  const effective = theme ?? systemTheme();

  const toggle = () => {
    const next: Theme = effective === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      className="nav-legend-btn theme-toggle"
      onClick={toggle}
      title={effective === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle color theme"
    >
      {effective === 'dark' ? '☀' : '☾'}
    </button>
  );
}
