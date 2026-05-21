'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

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
import { Textarea } from '@/components/ui/textarea';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils';
import { taskCreateSchema, type TaskCreateInput } from '@/lib/utils/validators/task';
import type { TaskRelatedTo } from '@/types/task';

import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from './TaskBadges';

export type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  businessUnit: string;
  dueDate: string;
};

const EMPTY: TaskFormValues = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  businessUnit: '',
  dueDate: '',
};

type Props = {
  defaultValues?: Partial<TaskFormValues>;
  /** When set, the form skips the BU picker and posts the task as related to this record. */
  relatedTo?: TaskRelatedTo;
  /** When `relatedTo` is set, lock the BU to its parent's BU. */
  lockedBusinessUnit?: string;
  onSubmit: (data: TaskCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
};

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function TaskForm({
  defaultValues,
  relatedTo,
  lockedBusinessUnit,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  isSubmitting = false,
}: Props) {
  const { businessUnits, currentBU } = useBusinessUnit();
  const { isAdmin } = useCurrentUser();

  const computedDefaultBU =
    lockedBusinessUnit ??
    defaultValues?.businessUnit ??
    (currentBU !== 'all' ? currentBU : businessUnits.length === 1 ? businessUnits[0]!.key : '');

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskCreateSchema) as never,
    defaultValues: { ...EMPTY, ...defaultValues, businessUnit: computedDefaultBU },
  });

  useEffect(() => {
    if (!defaultValues?.businessUnit && form.getValues('businessUnit') === '') {
      form.setValue('businessUnit', computedDefaultBU);
    }
  }, [computedDefaultBU, defaultValues?.businessUnit, form]);

  const { register, handleSubmit, control, formState } = form;
  const { errors } = formState;

  const buLocked = !!lockedBusinessUnit || (!isAdmin && businessUnits.length === 1);

  return (
    <form
      onSubmit={handleSubmit((data) =>
        onSubmit({
          ...(data as unknown as TaskCreateInput),
          relatedTo: relatedTo ?? null,
        }),
      )}
      className="space-y-5"
    >
      <Field label="Title" required error={errors.title?.message}>
        <Input autoFocus {...register('title')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" error={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label="Priority" error={errors.priority?.message}>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <div className={cn('grid gap-4', !lockedBusinessUnit && 'sm:grid-cols-2')}>
        {!lockedBusinessUnit && (
          <Field label="Business unit" required error={errors.businessUnit?.message}>
            <Controller
              control={control}
              name="businessUnit"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={buLocked}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a business unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits.map((bu) => (
                      <SelectItem key={bu.key} value={bu.key}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: bu.color }}
                          />
                          {bu.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}
        <Field label="Due date" error={errors.dueDate?.message}>
          <Input type="date" {...register('dueDate')} />
        </Field>
      </div>

      <Field label="Description" error={errors.description?.message}>
        <Textarea rows={3} {...register('description')} />
      </Field>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
