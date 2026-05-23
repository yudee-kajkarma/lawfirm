'use client';

import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useCreateUser } from '@/hooks/useUsers';
import { ApiError } from '@/lib/utils/apiFetch';
import type { UserCreateInput } from '@/lib/utils/validators/user';

export function NewUserClient() {
  const router = useRouter();
  const create = useCreateUser();
  const { businessUnits } = useBusinessUnit();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [buKeys, setBuKeys] = useState<string[]>([]);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleBU(key: string) {
    setBuKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Name is required');
    if (!email.trim()) return setError('Email is required');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    if (!isAdmin && buKeys.length === 0) {
      return setError(
        'Pick at least one business unit, or mark the user as admin (admins see all BUs).',
      );
    }

    const input: UserCreateInput = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      isAdmin,
      businessUnits: isAdmin ? [] : buKeys,
      isActive: true,
    };

    try {
      const u = await create.mutateAsync(input);
      toast.success(`${u.name} added`);
      router.push('/settings/users');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to create user';
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1 text-muted-foreground"
          onClick={() => router.push('/settings/users')}
        >
          <ArrowLeft className="size-3.5" />
          All users
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">New user</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set an initial password — share it with the user out-of-band. They can change it later.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Name<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Email<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Password<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Minimum 8 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Confirm<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Admin</Label>
                <p className="text-[11px] text-muted-foreground">
                  Full access to settings and every business unit.
                </p>
              </div>
              <Switch checked={isAdmin} onCheckedChange={setIsAdmin} aria-label="Toggle admin" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Business unit access
              {!isAdmin && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            {isAdmin ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Admins automatically see every business unit.
              </p>
            ) : businessUnits.length === 0 ? (
              <p className="text-xs text-muted-foreground">No business units configured.</p>
            ) : (
              <ul className="space-y-1.5">
                {businessUnits.map((bu) => (
                  <li key={bu.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`new-bu-${bu.key}`}
                      checked={buKeys.includes(bu.key)}
                      onCheckedChange={() => toggleBU(bu.key)}
                    />
                    <Label
                      htmlFor={`new-bu-${bu.key}`}
                      className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                    >
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: bu.color }}
                      />
                      {bu.name}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/settings/users')}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create user'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
