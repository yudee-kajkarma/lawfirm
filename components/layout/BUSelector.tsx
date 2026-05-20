'use client';

import { Building2, Check, ChevronDown } from 'lucide-react';

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
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

export function BUSelector() {
  const { currentBU, setCurrentBU, businessUnits } = useBusinessUnit();
  const { isAdmin } = useCurrentUser();

  const showAll = isAdmin || businessUnits.length > 1;
  const current = businessUnits.find((bu) => bu.key === currentBU);
  const label = currentBU === 'all' ? 'All business units' : (current?.name ?? 'Select unit');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="size-3.5 text-muted-foreground" />
          <span className="max-w-[10rem] truncate">{label}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Business unit
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showAll && (
          <DropdownMenuItem onSelect={() => setCurrentBU('all')} className="gap-2">
            <Check
              className={cn('size-3.5', currentBU === 'all' ? 'opacity-100' : 'opacity-0')}
            />
            <Building2 className="size-3.5 text-muted-foreground" />
            <span>All business units</span>
          </DropdownMenuItem>
        )}
        {businessUnits.map((bu) => (
          <DropdownMenuItem key={bu.key} onSelect={() => setCurrentBU(bu.key)} className="gap-2">
            <Check
              className={cn('size-3.5', currentBU === bu.key ? 'opacity-100' : 'opacity-0')}
            />
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: bu.color }}
              aria-hidden
            />
            <span>{bu.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
