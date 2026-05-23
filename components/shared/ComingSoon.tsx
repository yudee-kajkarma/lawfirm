'use client';

import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type Props = {
  /** Big icon at the top. */
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional ETA badge — e.g. "Phase 10" or "Q3 2026". */
  eta?: string;
  /** Bullet list of upcoming capabilities to set expectations. */
  features?: Feature[];
  /** Optional footer slot for "stay tuned" type messaging or a CTA. */
  footer?: ReactNode;
};

export function ComingSoon({ icon: Icon, title, description, eta, features, footer }: Props) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-2xl"
      >
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <Icon className="size-8 text-primary" />
          </div>

          {eta && (
            <Badge variant="outline" className="mt-6 gap-1 border-primary/30 bg-primary/5 text-primary">
              <Sparkles className="size-3" />
              {eta}
            </Badge>
          )}

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>

          {features && features.length > 0 && (
            <ul className="mx-auto mt-8 grid max-w-lg gap-3 text-left sm:grid-cols-2">
              {features.map((f, i) => (
                <motion.li
                  key={f.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 + i * 0.05, ease: 'easeOut' }}
                  className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/50 p-3"
                >
                  <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-md bg-secondary">
                    <f.icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{f.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{f.description}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}

          {footer && <div className="mt-8 text-xs text-muted-foreground">{footer}</div>}
        </div>
      </motion.div>
    </div>
  );
}
