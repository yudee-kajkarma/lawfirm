'use client';

import { Check, Filter, Plus, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useSmartLists } from '@/hooks/useSmartLists';
import type { SmartListEntity } from '@/lib/utils/smartListFields';
import { cn } from '@/lib/utils';

import { SmartListCreateDialog } from './SmartListCreateDialog';

type Props = {
  entity: SmartListEntity;
};

export function SmartListPicker({ entity }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { currentBU } = useBusinessUnit();

  const activeId = sp.get('smartListId');

  const filters = useMemo(
    () => ({
      entity,
      businessUnit: currentBU !== 'all' ? currentBU : undefined,
    }),
    [entity, currentBU],
  );
  const query = useSmartLists(filters);

  const setSmartListId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(sp.toString());
      if (id) params.set('smartListId', id);
      else params.delete('smartListId');
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  const lists = query.data ?? [];
  const active = activeId ? lists.find((l) => l._id === activeId) ?? null : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active ? 'secondary' : 'outline'}
          size="sm"
          className={cn('gap-2', active && 'border-primary/40')}
        >
          <Filter className="size-3.5" />
          <span className="max-w-[10rem] truncate">{active ? active.name : 'Smart list'}</span>
          {active && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setSmartListId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setSmartListId(null);
                }
              }}
              className="-mr-1 inline-flex size-4 cursor-pointer items-center justify-center rounded-full hover:bg-muted-foreground/20"
              aria-label="Clear smart list"
            >
              <X className="size-3" />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {currentBU === 'all'
            ? `Smart lists for ${entity}s (all BUs)`
            : `Smart lists for ${entity}s in ${currentBU}`}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {query.isLoading ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : lists.length === 0 ? (
          <DropdownMenuItem disabled>No smart lists yet</DropdownMenuItem>
        ) : (
          lists.map((sl) => {
            const isActive = sl._id === activeId;
            return (
              <DropdownMenuItem
                key={sl._id}
                onSelect={() => setSmartListId(sl._id)}
                className="gap-2"
              >
                <Check className={cn('size-3.5', isActive ? 'opacity-100' : 'opacity-0')} />
                <span className="flex-1 truncate">{sl.name}</span>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <SmartListCreateDialog
          defaultEntity={entity}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 text-primary">
              <Plus className="size-3.5" />
              New smart list…
            </DropdownMenuItem>
          }
        />
        {active && (
          <DropdownMenuItem onSelect={() => setSmartListId(null)} className="gap-2">
            <X className="size-3.5" />
            Clear filter
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
