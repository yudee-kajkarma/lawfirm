'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useConvertLead } from '@/hooks/useCases';
import { ApiError } from '@/lib/utils/apiFetch';
import type { ConvertLeadInput } from '@/lib/utils/validators/case';
import { convertLeadSchema } from '@/lib/utils/validators/case';
import type { Lead } from '@/types/lead';

type FormValues = {
  caseTitle: string;
  caseType: string;
};

type Props = {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LeadConvertDialog({ lead, open, onOpenChange }: Props) {
  const router = useRouter();
  const convert = useConvertLead();

  const form = useForm<FormValues>({
    resolver: zodResolver(convertLeadSchema) as never,
    defaultValues: {
      caseTitle: `${lead.firstName} ${lead.lastName}`.trim(),
      caseType: '',
    },
  });
  const { register, handleSubmit, control, formState } = form;
  const { errors } = formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert lead to case</DialogTitle>
          <DialogDescription>
            Creates a new client contact and opens a case under{' '}
            <span className="font-medium text-foreground">{lead.businessUnit}</span>. The lead
            stays in the system with stage <code>converted</code>.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(async (data) => {
            const input = data as unknown as ConvertLeadInput;
            try {
              const result = await convert.mutateAsync({ leadId: lead._id, input });
              toast.success(`Case ${result.case.caseNumber} opened`);
              onOpenChange(false);
              router.push(`/cases/${result.case._id}`);
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Failed to convert lead';
              toast.error(msg);
            }
          })}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="caseTitle" className="text-xs font-medium">
              Case title<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input id="caseTitle" autoFocus {...register('caseTitle')} />
            {errors.caseTitle && (
              <p className="text-xs text-destructive">{errors.caseTitle.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caseType" className="text-xs font-medium">
              Case type
            </Label>
            <Controller
              control={control}
              name="caseType"
              render={({ field }) => (
                <Input
                  id="caseType"
                  placeholder="e.g. civil_litigation, H1B"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.caseType && (
              <p className="text-xs text-destructive">{errors.caseType.message}</p>
            )}
          </div>

          <Textarea
            rows={2}
            disabled
            readOnly
            value={`A new ${lead.businessUnit.toUpperCase()} case will be opened for ${lead.firstName} ${lead.lastName}.`}
            className="resize-none bg-muted/30 text-xs text-muted-foreground"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={convert.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={convert.isPending}>
              {convert.isPending ? 'Converting…' : 'Convert'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
