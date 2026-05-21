import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

import { CountUp } from './CountUp';

type Props = {
  label: string;
  value: number | null;
  icon: LucideIcon;
  format?: (n: number) => string;
  hint?: string;
  index?: number;
};

export function StatCard({ label, value, icon: Icon, format, hint, index = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              {label}
            </CardDescription>
            <Icon className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {value == null ? <span className="text-muted-foreground">—</span> : (
              <CountUp value={value} format={format} />
            )}
          </div>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
