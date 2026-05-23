export type LineItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type LineItemComputed = LineItemInput & { amount: number };

export type InvoiceTotals = {
  lineItems: LineItemComputed[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
};

/**
 * Single source of truth for invoice math. Server runs this on every create /
 * update so the persisted totals can't be tampered with client-side.
 *
 * Order of operations matters: tax applies to the **discounted** subtotal,
 * matching most jurisdictions (sales tax / GST / VAT are computed on the
 * net-of-discount amount).
 *
 * All amounts are rounded to 2 decimal places to keep float-precision noise
 * out of stored values.
 */
export function computeInvoiceTotals(args: {
  lineItems: LineItemInput[];
  discountPercent?: number;
  taxRate?: number;
}): InvoiceTotals {
  const discountPercent = clampPercent(args.discountPercent ?? 0);
  const taxRate = clampPercent(args.taxRate ?? 0);

  const lineItems: LineItemComputed[] = args.lineItems.map((li) => ({
    description: li.description,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    amount: round2(li.quantity * li.unitPrice),
  }));

  const subtotal = round2(lineItems.reduce((acc, li) => acc + li.amount, 0));
  const discountAmount = round2((subtotal * discountPercent) / 100);
  const discountedSubtotal = round2(subtotal - discountAmount);
  const taxAmount = round2((discountedSubtotal * taxRate) / 100);
  const total = round2(discountedSubtotal + taxAmount);

  return { lineItems, subtotal, discountAmount, taxAmount, total };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 100) return 100;
  return n;
}
