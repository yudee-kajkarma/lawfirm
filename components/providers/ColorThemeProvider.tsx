'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export const COLOR_THEMES = [
  { key: 'default', label: 'Default', swatch: 'oklch(0.205 0 0)' },
  { key: 'rose', label: 'Rose', swatch: 'oklch(0.625 0.235 19)' },
  { key: 'orange', label: 'Orange', swatch: 'oklch(0.680 0.200 50)' },
  { key: 'violet', label: 'Violet', swatch: 'oklch(0.540 0.230 295)' },
  { key: 'blue', label: 'Blue', swatch: 'oklch(0.540 0.230 262)' },
  { key: 'green', label: 'Green', swatch: 'oklch(0.540 0.150 148)' },
] as const;

export type ColorThemeKey = (typeof COLOR_THEMES)[number]['key'];

type Ctx = {
  colorTheme: ColorThemeKey;
  setColorTheme: (theme: ColorThemeKey) => void;
};

const ColorThemeContext = createContext<Ctx | null>(null);

const STORAGE_KEY = 'instapath:colorTheme';
const VALID_KEYS = new Set<string>(COLOR_THEMES.map((t) => t.key));

function isValid(value: string | null): value is ColorThemeKey {
  return value !== null && VALID_KEYS.has(value);
}

type Props = {
  children: ReactNode;
  /** Theme to render before the localStorage hydration kicks in. */
  defaultTheme?: ColorThemeKey;
};

export function ColorThemeProvider({ children, defaultTheme = 'default' }: Props) {
  const [colorTheme, setColorThemeState] = useState<ColorThemeKey>(defaultTheme);

  // Hydrate from localStorage on mount. We avoid running this during render
  // so the initial server-rendered HTML matches the client output (the
  // attribute gets set after first paint, which is what every theme manager
  // does — accept a one-frame flash for the small set of users with a non-
  // default theme).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isValid(saved)) setColorThemeState(saved);
  }, []);

  // Apply the attribute to <html>. The CSS rules in globals.css key off this.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', colorTheme);
  }, [colorTheme]);

  const setColorTheme = useCallback((theme: ColorThemeKey) => {
    setColorThemeState(theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }, []);

  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme(): Ctx {
  const ctx = useContext(ColorThemeContext);
  if (!ctx) {
    throw new Error('useColorTheme must be used inside <ColorThemeProvider>');
  }
  return ctx;
}
