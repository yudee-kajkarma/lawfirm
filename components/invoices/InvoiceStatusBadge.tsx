import { Badge } from '@/components/ui/badge';
import type { InvoiceStatus } from '@/lib/constants/enums';
import { cn } from '@/lib/utils';

const STYLES: Record<
  InvoiceStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  draft: { variant: 'secondary' },
  sent: { variant: 'default' },
  paid: {
    variant: 'outline',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  overdue: {
    variant: 'outline',
    className: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  },
  void: { variant: 'outline' },
};

const LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STYLES[status];
  return (
    <Badge variant={s.variant} className={cn('whitespace-nowrap', s.className)}>
      {LABELS[status]}
    </Badge>
  );
}
