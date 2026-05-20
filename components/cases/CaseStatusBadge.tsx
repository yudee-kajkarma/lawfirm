import { Badge } from '@/components/ui/badge';
import type { CaseStatus } from '@/lib/constants/enums';
import { cn } from '@/lib/utils';

const STYLES: Record<
  CaseStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  open: { variant: 'default' },
  in_progress: {
    variant: 'outline',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  on_hold: { variant: 'secondary' },
  closed: {
    variant: 'outline',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
};

const LABELS: Record<CaseStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  closed: 'Closed',
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const s = STYLES[status];
  return (
    <Badge variant={s.variant} className={cn('whitespace-nowrap', s.className)}>
      {LABELS[status]}
    </Badge>
  );
}
