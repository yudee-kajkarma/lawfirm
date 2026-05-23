'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateBusinessUnit } from '@/hooks/useBusinessUnits';
import { ApiError } from '@/lib/utils/apiFetch';
import type { BusinessUnitCreateInput } from '@/lib/utils/validators/businessUnit';

// Slugifier just for the suggestion UI — the server enforces the regex too,
// so anything the user types still has to pass validation before it lands.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewBusinessUnitClient() {
  const router = useRouter();
  const create = useCreateBusinessUnit();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyDirty, setKeyDirty] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#64748b');
  const [order, setOrder] = useState('100');
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest a slug while the admin hasn't manually touched the key field.
  function handleNameChange(value: string) {
    setName(value);
    if (!keyDirty) setKey(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Name is required');
    if (!key.trim()) return setError('Key is required');

    const input: BusinessUnitCreateInput = {
      key: key.trim(),
      name: name.trim(),
      description: description.trim() || null,
      color,
      order: Number(order) || 0,
      isActive: true,
    };

    try {
      const bu = await create.mutateAsync(input);
      toast.success(`${bu.name} created`);
      // Refresh so the dashboard layout re-reads BUs and the new unit shows
      // up in the BU selector immediately.
      router.refresh();
      router.push('/settings/business-units');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to create business unit';
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
          onClick={() => router.push('/settings/business-units')}
        >
          <ArrowLeft className="size-3.5" />
          All business units
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">New business unit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a permanent key — it&apos;s referenced by every record in this unit and
            cannot be renamed later.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Name<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Estate Planning"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Key<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setKeyDirty(true);
              }}
              className="font-mono"
              placeholder="estate-planning"
            />
            <p className="text-[11px] text-muted-foreground">
              Lowercase letters, digits, hyphens, and underscores only. Cannot be changed later.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kinds of cases or work this unit handles."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent p-1"
                  aria-label="Pick color"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#1d4ed8"
                  className="flex-1 font-mono"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Shows up as the dot beside this unit&apos;s name in pills and selectors.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Order</Label>
              <Input
                type="number"
                min={0}
                max={9999}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Lower numbers appear first.</p>
            </div>
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
              onClick={() => router.push('/settings/business-units')}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create business unit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
