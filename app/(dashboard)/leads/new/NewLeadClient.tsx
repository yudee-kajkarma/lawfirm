'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { LeadForm } from '@/components/leads/LeadForm';
import { Button } from '@/components/ui/button';
import { useCreateLead } from '@/hooks/useLeads';
import { ApiError } from '@/lib/utils/apiFetch';

export function NewLeadClient() {
  const router = useRouter();
  const create = useCreateLead();

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1 text-muted-foreground"
          onClick={() => router.push('/leads')}
        >
          <ArrowLeft className="size-3.5" />
          All leads
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New lead</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture an inquiry to track through your pipeline.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <LeadForm
          submitLabel="Create lead"
          isSubmitting={create.isPending}
          onCancel={() => router.push('/leads')}
          onSubmit={async (data) => {
            try {
              const lead = await create.mutateAsync(data);
              toast.success(`${lead.firstName} ${lead.lastName} added`);
              router.push('/leads');
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Failed to create lead';
              toast.error(msg);
            }
          }}
        />
      </div>
    </div>
  );
}
