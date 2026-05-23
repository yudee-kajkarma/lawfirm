'use client';

import { LogOut, Monitor, Moon, Palette, Shield, Sun } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  COLOR_THEMES,
  useColorTheme,
  type ColorThemeKey,
} from '@/components/providers/ColorThemeProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}

export function UserMenu() {
  const { user, isAdmin } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full p-0"
          aria-label="Account menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-[11px] font-medium">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5 font-normal">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
          {isAdmin && (
            <div className="mt-1 flex items-center gap-1 text-xs text-primary">
              <Shield className="size-3" />
              <span>Administrator</span>
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-sm">
            <Palette className="size-4" />
            <span className="flex-1">Theme</span>
            <span
              className="size-3 rounded-full border border-border"
              style={{ backgroundColor: swatchOf(colorTheme) }}
              aria-hidden="true"
            />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuRadioGroup
              value={colorTheme}
              onValueChange={(v) => setColorTheme(v as ColorThemeKey)}
            >
              {COLOR_THEMES.map((t) => (
                <DropdownMenuRadioItem key={t.key} value={t.key} className="gap-2 text-sm">
                  <span
                    className="size-3 flex-shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: t.swatch }}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{t.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-sm">
            <ModeIcon mode={theme} />
            <span className="flex-1">Mode</span>
            <span className="text-xs capitalize text-muted-foreground">{theme ?? 'system'}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light" className="gap-2 text-sm">
                <Sun className="size-3.5" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="gap-2 text-sm">
                <Moon className="size-3.5" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" className="gap-2 text-sm">
                <Monitor className="size-3.5" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => signOut({ callbackUrl: '/login' })}
          className="gap-2 text-sm"
        >
          <LogOut className="size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function swatchOf(key: ColorThemeKey): string {
  return COLOR_THEMES.find((t) => t.key === key)?.swatch ?? 'oklch(0.205 0 0)';
}

function ModeIcon({ mode }: { mode: string | undefined }) {
  if (mode === 'dark') return <Moon className="size-4" />;
  if (mode === 'light') return <Sun className="size-4" />;
  return <Monitor className="size-4" />;
}
