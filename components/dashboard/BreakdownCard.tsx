'use client';

import { motion } from 'motion/react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type BreakdownItem = {
  key: string;
  label: string;
  count: number;
  /** Hex color or tailwind utility class fragment for the bar fill. */
  color?: string;
};

type Props = {
  title: string;
  items: BreakdownItem[];
  emptyMessage?: string;
  className?: string;
};

export function BreakdownCard({ title, items, emptyMessage, className }: Props) {
  const max = items.reduce((acc, i) => Math.max(acc, i.count), 0);
  const total = items.reduce((acc, i) => acc + i.count, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {total.toLocaleString()} total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyMessage ?? 'No data yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, i) => {
              const pct = max === 0 ? 0 : (item.count / max) * 100;
              return (
                <li key={item.key} className="flex items-center gap-3 text-sm">
                  <span className="w-28 truncate text-xs text-muted-foreground">{item.label}</span>
                  <div className="relative flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                      className={cn('h-2 rounded-full', !item.color && 'bg-primary')}
                      style={item.color ? { backgroundColor: item.color } : undefined}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums">{item.count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
