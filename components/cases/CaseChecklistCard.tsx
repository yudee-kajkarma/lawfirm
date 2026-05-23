'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCaseChecklist,
  useCreateChecklistItem,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
} from '@/hooks/useCaseChecklist';
import { ApiError } from '@/lib/utils/apiFetch';
import { cn } from '@/lib/utils';

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CaseChecklistCard({ caseId }: { caseId: string }) {
  const list = useCaseChecklist(caseId);
  const create = useCreateChecklistItem(caseId);
  const update = useUpdateChecklistItem(caseId);
  const del = useDeleteChecklistItem(caseId);

  const [newTitle, setNewTitle] = useState('');

  async function addItem() {
    const title = newTitle.trim();
    if (!title) return;
    try {
      await create.mutateAsync({ title });
      setNewTitle('');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to add item';
      toast.error(msg);
    }
  }

  async function toggleItem(id: string, completed: boolean) {
    try {
      await update.mutateAsync({ id, patch: { completed } });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to update item';
      toast.error(msg);
    }
  }

  async function deleteItem(id: string) {
    try {
      await del.mutateAsync(id);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to delete item';
      toast.error(msg);
    }
  }

  function onAddKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void addItem();
    }
  }

  const items = list.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Checklist</span>
          {items.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {items.filter((i) => i.completed).length} / {items.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.isLoading ? (
          <>
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-3/4" />
          </>
        ) : list.isError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-center text-xs">
            <p className="text-destructive">{(list.error as Error).message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => list.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items yet — add the first task below.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const due = formatDue(item.dueDate);
              return (
                <li
                  key={item._id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => void toggleItem(item._id, !item.completed)}
                    className="size-4 rounded border-border accent-primary"
                  />
                  <span
                    className={cn(
                      'flex-1 text-sm',
                      item.completed && 'text-muted-foreground line-through',
                    )}
                  >
                    {item.title}
                  </span>
                  {due && <span className="text-xs text-muted-foreground">{due}</span>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => void deleteItem(item._id)}
                    aria-label="Delete item"
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Input
            placeholder="Add a checklist item…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={onAddKey}
            disabled={create.isPending}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void addItem()}
            disabled={create.isPending || !newTitle.trim()}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
