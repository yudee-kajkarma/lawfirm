'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { formatCurrency } from './format';

export type LineItemDraft = {
  description: string;
  quantity: string; // form-friendly string; coerced to number on submit
  unitPrice: string;
};

type Props = {
  items: LineItemDraft[];
  onChange: (next: LineItemDraft[]) => void;
  currency: string;
  /** Disabled when status !== 'draft' on edit. */
  disabled?: boolean;
};

export function makeBlankLineItem(): LineItemDraft {
  return { description: '', quantity: '1', unitPrice: '0' };
}

function rowAmount(li: LineItemDraft): number {
  const q = Number(li.quantity);
  const p = Number(li.unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return Math.max(0, q * p);
}

export function LineItemsEditor({ items, onChange, currency, disabled }: Props) {
  function update(index: number, patch: Partial<LineItemDraft>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...items, makeBlankLineItem()]);
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Description</th>
              <th className="w-24 px-3 py-2 text-right">Qty</th>
              <th className="w-32 px-3 py-2 text-right">Unit price</th>
              <th className="w-32 px-3 py-2 text-right">Amount</th>
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No line items yet — add the first below.
                </td>
              </tr>
            ) : (
              items.map((li, i) => (
                <tr key={i} className="align-top">
                  <td className="px-3 py-2">
                    <Input
                      value={li.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                      placeholder="e.g. Legal consultation — 2 hours"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={li.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value })}
                      className="text-right tabular-nums"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={li.unitPrice}
                      onChange={(e) => update(i, { unitPrice: e.target.value })}
                      className="text-right tabular-nums"
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">
                    {formatCurrency(rowAmount(li), currency)}
                  </td>
                  <td className="px-1 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => remove(i)}
                      disabled={disabled}
                      aria-label="Remove line"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={add}
        disabled={disabled}
      >
        <Plus className="size-3.5" />
        Add line item
      </Button>
    </div>
  );
}
