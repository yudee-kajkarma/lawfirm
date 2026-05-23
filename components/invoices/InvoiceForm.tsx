'use client';

import { useMemo, useState } from 'react';

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
import { computeInvoiceTotals } from '@/lib/services/invoiceTotals';
import {
  SUPPORTED_CURRENCIES,
  type InvoiceCreateInput,
  type SupportedCurrency,
} from '@/lib/utils/validators/invoice';

import { ContactPicker } from '@/components/shared/ContactPicker';

import { LineItemsEditor, makeBlankLineItem, type LineItemDraft } from './LineItemsEditor';
import { formatCurrency, isoToDateInput } from './format';

const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  USD: 'USD — US Dollar',
  EUR: 'EUR — Euro',
  GBP: 'GBP — British Pound',
  INR: 'INR — Indian Rupee',
};

export type InvoiceFormDefaults = {
  title?: string;
  clientId?: string | null;
  caseId?: string | null;
  businessUnit?: string;
  currency?: SupportedCurrency;
  issueDate?: string;
  dueDate?: string;
  lineItems?: LineItemDraft[];
  discountPercent?: string;
  taxRate?: string;
  notes?: string;
  internalNotes?: string;
};

type Props = {
  mode: 'create' | 'edit';
  defaultValues?: InvoiceFormDefaults;
  onSubmit: (input: InvoiceCreateInput) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  /** When true, BU + client + case + currency become read-only — used in edit mode. */
  immutableCoreFields?: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultDueIso(): string {
  // Default to +30 days as the most common net-30 invoice term.
  return new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
}

export function InvoiceForm({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting,
  immutableCoreFields,
}: Props) {
  const { businessUnits, currentBU } = useBusinessUnit();
  const { isAdmin } = useCurrentUser();

  const initialBU =
    defaultValues?.businessUnit ??
    (currentBU !== 'all' ? currentBU : businessUnits.length === 1 ? businessUnits[0]!.key : '');

  const [title, setTitle] = useState(defaultValues?.title ?? '');
  const [clientId, setClientId] = useState<string | null>(defaultValues?.clientId ?? null);
  const [caseId] = useState<string | null>(defaultValues?.caseId ?? null);
  const [businessUnit, setBusinessUnit] = useState(initialBU);
  const [currency, setCurrency] = useState<SupportedCurrency>(
    defaultValues?.currency ?? 'USD',
  );
  const [issueDate, setIssueDate] = useState(defaultValues?.issueDate ?? todayIso());
  const [dueDate, setDueDate] = useState(defaultValues?.dueDate ?? defaultDueIso());
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(
    defaultValues?.lineItems && defaultValues.lineItems.length > 0
      ? defaultValues.lineItems
      : [makeBlankLineItem()],
  );
  const [discountPercent, setDiscountPercent] = useState(defaultValues?.discountPercent ?? '0');
  const [taxRate, setTaxRate] = useState(defaultValues?.taxRate ?? '0');
  const [notes, setNotes] = useState(defaultValues?.notes ?? '');
  const [internalNotes, setInternalNotes] = useState(defaultValues?.internalNotes ?? '');
  const [error, setError] = useState<string | null>(null);

  const buLocked = immutableCoreFields || (!isAdmin && businessUnits.length === 1);

  // Live preview of the totals — mirrors what the server will compute.
  const totals = useMemo(() => {
    const parsedItems = lineItems
      .filter((li) => li.description.trim() !== '')
      .map((li) => ({
        description: li.description.trim(),
        quantity: Number(li.quantity) || 0,
        unitPrice: Number(li.unitPrice) || 0,
      }));
    return computeInvoiceTotals({
      lineItems: parsedItems,
      discountPercent: Number(discountPercent) || 0,
      taxRate: Number(taxRate) || 0,
    });
  }, [lineItems, discountPercent, taxRate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) return setError('Pick a client');
    if (!businessUnit) return setError('Pick a business unit');
    if (!dueDate) return setError('Due date is required');

    const nonEmptyItems = lineItems.filter((li) => li.description.trim() !== '');
    if (nonEmptyItems.length === 0) return setError('Add at least one line item');

    const input: InvoiceCreateInput = {
      title: title.trim() || null,
      clientId,
      caseId: caseId ?? null,
      businessUnit,
      currency,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      lineItems: nonEmptyItems.map((li) => ({
        description: li.description.trim(),
        quantity: Number(li.quantity) || 0,
        unitPrice: Number(li.unitPrice) || 0,
      })),
      discountPercent: Number(discountPercent) || 0,
      taxRate: Number(taxRate) || 0,
      notes: notes.trim() || null,
      internalNotes: internalNotes.trim() || null,
    };

    await onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Title</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Legal services — August 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Currency<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Select
            value={currency}
            onValueChange={(v) => setCurrency(v as SupportedCurrency)}
            disabled={immutableCoreFields}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Client<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <ContactPicker
            value={clientId}
            onChange={(id) => setClientId(id)}
            businessUnit={businessUnit || undefined}
            disabled={immutableCoreFields}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Business unit<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Select
            value={businessUnit}
            onValueChange={setBusinessUnit}
            disabled={buLocked}
          >
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Issue date</Label>
          <Input
            type="date"
            value={isoToDateInput(issueDate)}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Due date<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={isoToDateInput(dueDate)}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Line items</Label>
        <LineItemsEditor items={lineItems} onChange={setLineItems} currency={currency} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Discount %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Tax rate %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
        </div>
      </div>

      {/* Totals preview — re-computes live, mirrors server math. */}
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatCurrency(totals.subtotal, currency)}</dd>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Discount ({discountPercent}%)</dt>
              <dd className="tabular-nums">−{formatCurrency(totals.discountAmount, currency)}</dd>
            </div>
          )}
          {totals.taxAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Tax ({taxRate}%)</dt>
              <dd className="tabular-nums">{formatCurrency(totals.taxAmount, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrency(totals.total, currency)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Notes (shown on invoice)</Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment terms, thank-you note, etc."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Internal notes (private)</Label>
          <Textarea
            rows={2}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Won't appear on the PDF."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving…'
            : mode === 'create'
              ? 'Create draft invoice'
              : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
