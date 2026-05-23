'use client';

import { Bot, Globe, History, Plus, RefreshCcw, Trash2, User } from 'lucide-react';
import type { ComponentType } from 'react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { AuditLog } from '@/types/auditLog';

type Props = {
  entry: AuditLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ACTION_STYLE: Record<
  string,
  {
    label: string;
    icon: ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  create: {
    label: 'Created',
    icon: Plus,
    className:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  update: {
    label: 'Updated',
    icon: History,
    className: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  delete: {
    label: 'Deleted',
    icon: Trash2,
    className: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  restore: {
    label: 'Restored',
    icon: RefreshCcw,
    className:
      'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
};

const SOURCE_LABEL: Record<string, { label: string; icon: ComponentType<{ className?: string }> }> = {
  user: { label: 'User', icon: User },
  system: { label: 'System', icon: Bot },
  webhook: { label: 'Webhook', icon: Globe },
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

// Render a single before/after value. The shapes vary wildly (string, number,
// boolean, null, array, plain object) because the audit log captures whatever
// the schema field held — we render whatever's safe and stringify the rest.
function ValueCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="italic text-muted-foreground">empty</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="font-mono text-xs">{value ? 'true' : 'false'}</span>;
  }
  if (typeof value === 'number') {
    return <span className="font-mono text-xs tabular-nums">{value}</span>;
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const d = new Date(value);
      if (Number.isFinite(d.getTime())) {
        return <span className="text-xs">{d.toLocaleString()}</span>;
      }
    }
    if (value === '') return <span className="italic text-muted-foreground">empty string</span>;
    return <span className="break-all text-xs">{value}</span>;
  }
  return (
    <pre className="overflow-x-auto rounded bg-muted/50 px-1.5 py-1 font-mono text-[11px] leading-tight">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function AuditLogDetailSheet({ entry, open, onOpenChange }: Props) {
  const actionMeta = ACTION_STYLE[entry.action] ?? ACTION_STYLE.update!;
  const sourceMeta = SOURCE_LABEL[entry.source] ?? SOURCE_LABEL.user!;
  const ActionIcon = actionMeta.icon;
  const SourceIcon = sourceMeta.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`gap-1 ${actionMeta.className}`}>
              <ActionIcon className="size-3" />
              {actionMeta.label}
            </Badge>
            <span className="font-mono text-sm">{entry.collectionName}</span>
          </SheetTitle>
          <SheetDescription>
            <span className="font-mono text-xs">{entry.documentId}</span>
            <span className="mx-1.5">·</span>
            {formatTimestamp(entry.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 text-xs sm:grid-cols-2">
            <Meta label="Actor">
              {entry.actorEmail ? (
                <span className="break-all">{entry.actorEmail}</span>
              ) : (
                <span className="italic text-muted-foreground">none</span>
              )}
            </Meta>
            <Meta label="Source">
              <span className="inline-flex items-center gap-1">
                <SourceIcon className="size-3" />
                {sourceMeta.label}
              </span>
            </Meta>
            <Meta label="Business unit">
              {entry.businessUnit ?? (
                <span className="italic text-muted-foreground">n/a</span>
              )}
            </Meta>
            <Meta label="IP">
              {entry.ip ? (
                <span className="font-mono">{entry.ip}</span>
              ) : (
                <span className="italic text-muted-foreground">unknown</span>
              )}
            </Meta>
            {entry.userAgent && (
              <Meta label="User agent" className="sm:col-span-2">
                <span className="break-all text-[11px] text-muted-foreground">
                  {entry.userAgent}
                </span>
              </Meta>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Changes ({entry.changes.length})
            </h3>
            {entry.changes.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                No tracked field changes. (For users, password and last-login changes are
                intentionally excluded from the log.)
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium">Before</th>
                      <th className="px-3 py-2 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entry.changes.map((c, i) => (
                      <tr key={`${c.path}-${i}`} className="align-top">
                        <td className="px-3 py-2 font-mono text-[11px] text-foreground">
                          {c.path}
                        </td>
                        <td className="px-3 py-2">
                          <ValueCell value={c.before} />
                        </td>
                        <td className="px-3 py-2">
                          <ValueCell value={c.after} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Meta({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-foreground">{children}</div>
    </div>
  );
}
