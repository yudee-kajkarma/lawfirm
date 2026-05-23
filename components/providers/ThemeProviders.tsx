'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { ColorThemeProvider } from './ColorThemeProvider';

type Props = { children: ReactNode };

/**
 * Combined provider for both axes of theming:
 *   1. `next-themes` handles light / dark / system mode via a class on <html>.
 *   2. `ColorThemeProvider` handles the color palette via a data-theme attr.
 *
 * Both are read by the CSS in globals.css — see the `[data-theme="x"]` and
 * `.dark[data-theme="x"]` selectors there.
 */
export function ThemeProviders({ children }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ColorThemeProvider>{children}</ColorThemeProvider>
    </NextThemesProvider>
  );
}
