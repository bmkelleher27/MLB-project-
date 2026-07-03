import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function stored(): Theme | null {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(stored);
  const effective = theme ?? systemTheme();

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // private mode etc - theme just won't persist
    }
  }, [theme]);

  return (
    <button
      className="nav-legend-btn theme-toggle"
      onClick={() => setTheme(effective === 'dark' ? 'light' : 'dark')}
      title={effective === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle color theme"
    >
      {effective === 'dark' ? '☀' : '☾'}
    </button>
  );
}
