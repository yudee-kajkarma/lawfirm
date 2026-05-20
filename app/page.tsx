'use client';

import { motion } from 'motion/react';
import { ArrowRight, Briefcase, Scale, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const businessUnits = [
  {
    name: 'Immigration',
    icon: Briefcase,
    description: 'Visa applications, status tracking, document workflows.',
  },
  {
    name: 'Law',
    icon: Scale,
    description: 'Case management, hearings, billable time, client communications.',
  },
  {
    name: 'Wealth',
    icon: TrendingUp,
    description: 'Portfolio reviews, advisory cases, compliance documentation.',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center"
        >
          <span className="inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Phase 0a · Foundation ready
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-foreground">
            InstaPath CRM
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            One platform, three practices. Capture leads, qualify them, convert to clients, manage
            cases end-to-end.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg">
              Continue setup
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button size="lg" variant="outline">
              Read docs
            </Button>
          </div>
        </motion.div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {businessUnits.map((bu, i) => (
            <motion.div
              key={bu.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut', delay: 0.15 + i * 0.08 }}
            >
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                    <bu.icon className="size-5 text-foreground" />
                  </div>
                  <CardTitle className="mt-4">{bu.name}</CardTitle>
                  <CardDescription>{bu.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Routed via the business-unit selector in the header.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
