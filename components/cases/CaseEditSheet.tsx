'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateCase } from '@/hooks/useCases';
import { CASE_STATUSES, type CaseStatus } from '@/lib/constants/enums';
import { ApiError } from '@/lib/utils/apiFetch';
import { caseUpdateSchema, type CaseUpdateInput } from '@/lib/utils/validators/case';
import type { Case } from '@/types/case';

type FormValues = {
  title: string;
  description: string;
  caseType: string;
  status: CaseStatus;
  value: string;
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  closed: 'Closed',
};

type Props = {
  caseDoc: Case;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CaseEditSheet({ caseDoc, open, onOpenChange }: Props) {
  const update = useUpdateCase();

  const form = useForm<FormValues>({
    resolver: zodResolver(caseUpdateSchema) as never,
    defaultValues: {
      title: caseDoc.title,
      description: caseDoc.description ?? '',
      caseType: caseDoc.caseType ?? '',
      status: caseDoc.status,
      value: caseDoc.value != null ? String(caseDoc.value) : '',
    },
  });
  const { register, handleSubmit, control, formState } = form;
  const { errors } = formState;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit case</SheetTitle>
          <SheetDescription>Updating {caseDoc.caseNumber}.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <form
            onSubmit={handleSubmit(async (data) => {
              try {
                await update.mutateAsync({
                  id: caseDoc._id,
                  patch: data as unknown as CaseUpdateInput,
                });
                toast.success('Case updated');
                onOpenChange(false);
              } catch (e) {
                const msg = e instanceof ApiError ? e.message : 'Failed to update case';
                toast.error(msg);
              }
            })}
            className="space-y-5"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Title<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Input autoFocus {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CASE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Case type</Label>
                <Input {...register('caseType')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Estimated value</Label>
              <Input type="number" min={0} step="0.01" {...register('value')} />
              {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea rows={3} {...register('description')} />
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
