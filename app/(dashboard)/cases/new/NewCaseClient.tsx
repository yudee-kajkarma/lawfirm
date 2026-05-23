'use client';

import { ArrowLeft, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { ClientPicker, type ClientSelection } from '@/components/cases/ClientPicker';
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
import { useConvertLead, useCreateCase } from '@/hooks/useCases';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ApiError } from '@/lib/utils/apiFetch';
import type { CaseCreateInput, ConvertLeadInput } from '@/lib/utils/validators/case';

type Props = {
  initialClientId?: string;
  initialBusinessUnit?: string;
  initialTitle?: string;
};

export function NewCaseClient({
  initialClientId,
  initialBusinessUnit,
  initialTitle,
}: Props) {
  const router = useRouter();
  const create = useCreateCase();
  const convert = useConvertLead();
  const { businessUnits, currentBU } = useBusinessUnit();
  const { isAdmin } = useCurrentUser();

  const computedBU =
    initialBusinessUnit ??
    (currentBU !== 'all' ? currentBU : businessUnits.length === 1 ? businessUnits[0]!.key : '');

  const [title, setTitle] = useState(initialTitle ?? '');
  const [description, setDescription] = useState('');
  const [caseType, setCaseType] = useState('');
  const [businessUnit, setBusinessUnit] = useState(computedBU);
  const [client, setClient] = useState<ClientSelection | null>(
    initialClientId
      ? { kind: 'contact', id: initialClientId, businessUnit: computedBU, displayName: '' }
      : null,
  );
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // When a lead is picked the BU is locked to the lead's BU — converting it
  // mid-flow into a different BU would be confusing and the server enforces
  // them to match anyway.
  const buLockedByLead = client?.kind === 'lead';
  const buLockedBySingleBU = !isAdmin && businessUnits.length === 1;
  const buLocked = buLockedByLead || buLockedBySingleBU;

  function handleClient(sel: ClientSelection) {
    setClient(sel);
    // Snap BU to whatever the selected entity belongs to.
    setBusinessUnit(sel.businessUnit);
  }

  const isSubmitting = create.isPending || convert.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError('Title is required');
    if (!client) return setError('Pick a client');
    if (!businessUnit) return setError('Pick a business unit');

    try {
      if (client.kind === 'lead') {
        const input: ConvertLeadInput = {
          caseTitle: title.trim(),
          caseType: caseType.trim() || null,
          caseDescription: description.trim() || null,
          caseValue: value ? Number(value) : null,
          caseTags: [],
        };
        const result = await convert.mutateAsync({ leadId: client.id, input });
        toast.success(`Case ${result.case.caseNumber} created from lead`);
      } else {
        const input: CaseCreateInput = {
          title: title.trim(),
          description: description.trim() || null,
          caseType: caseType.trim() || null,
          status: 'open',
          businessUnit,
          clientId: client.id,
          value: value ? Number(value) : null,
          tags: [],
        };
        const c = await create.mutateAsync(input);
        toast.success(`Case ${c.caseNumber} created`);
      }
      router.push('/cases');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to create case';
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1 text-muted-foreground"
          onClick={() => router.push('/cases')}
        >
          <ArrowLeft className="size-3.5" />
          All cases
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New case</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a case for an existing contact, or pick a lead to convert and open in one step.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Title<span className="ml-0.5 text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. H1B sponsorship for Acme Corp"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Client<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <ClientPicker
                value={client ? { kind: client.kind, id: client.id } : null}
                onChange={handleClient}
                businessUnit={businessUnit || undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Business unit<span className="ml-0.5 text-destructive">*</span>
              </Label>
              <Select value={businessUnit} onValueChange={setBusinessUnit} disabled={buLocked}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a business unit" />
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
            </div>
          </div>

          {client?.kind === 'lead' && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" />
              <div>
                <span className="font-medium">{client.displayName}</span> is a lead. Creating this
                case will convert them to a client and mark the lead as converted. The case will be
                opened in their lead&apos;s business unit.
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Case type</Label>
              <Input
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                placeholder="e.g. H1B, civil_litigation"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Estimated value</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Background, scope, anything the team should know up front."
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/cases')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? client?.kind === 'lead'
                  ? 'Converting…'
                  : 'Creating…'
                : client?.kind === 'lead'
                  ? 'Convert & create case'
                  : 'Create case'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
