import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Invoice, serializeInvoice } from '@/lib/models/Invoice';
import { computeInvoiceTotals } from '@/lib/services/invoiceTotals';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { invoiceUpdateSchema } from '@/lib/utils/validators/invoice';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Invoice not found', 404);
  }
  const inv = await Invoice.findOne({ _id: params.id, ...scopedQuery(user) }).lean();
  if (!inv) return apiError('NOT_FOUND', 'Invoice not found', 404);
  return apiOk({ data: serializeInvoice(inv as Record<string, unknown>) });
});

/**
 * Edit allowed ONLY while status === 'draft'. Sent / paid / void invoices are
 * frozen accounting records — fix mistakes via Void + create a new invoice.
 */
export const PATCH = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Invoice not found', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = invoiceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid invoice data', 400, parsed.error.flatten());
  }

  const inv = await Invoice.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!inv) return apiError('NOT_FOUND', 'Invoice not found', 404);
  if (inv.status !== 'draft') {
    return apiError(
      'CONFLICT',
      `Cannot edit invoice in status "${inv.status}". Void it and create a new one.`,
      409,
    );
  }

  // Disallow changing client / case / BU on edit — those decisions are
  // architectural enough that creating fresh is cleaner.
  for (const forbidden of ['clientId', 'caseId', 'businessUnit'] as const) {
    if (parsed.data[forbidden] !== undefined) {
      return apiError(
        'VALIDATION_ERROR',
        `Cannot change "${forbidden}" after creation`,
        400,
      );
    }
  }

  if (parsed.data.title !== undefined) inv.set('title', parsed.data.title ?? null);
  if (parsed.data.currency !== undefined) inv.set('currency', parsed.data.currency);
  if (parsed.data.issueDate !== undefined) inv.set('issueDate', parsed.data.issueDate);
  if (parsed.data.dueDate !== undefined) inv.set('dueDate', parsed.data.dueDate);
  if (parsed.data.notes !== undefined) inv.set('notes', parsed.data.notes ?? null);
  if (parsed.data.internalNotes !== undefined)
    inv.set('internalNotes', parsed.data.internalNotes ?? null);

  // Recompute totals whenever any input that feeds them changes.
  const recompute =
    parsed.data.lineItems !== undefined ||
    parsed.data.discountPercent !== undefined ||
    parsed.data.taxRate !== undefined;

  if (recompute) {
    const totals = computeInvoiceTotals({
      lineItems: parsed.data.lineItems ?? inv.lineItems,
      discountPercent: parsed.data.discountPercent ?? inv.discountPercent ?? 0,
      taxRate: parsed.data.taxRate ?? inv.taxRate ?? 0,
    });
    inv.set('lineItems', totals.lineItems);
    inv.set('subtotal', totals.subtotal);
    inv.set('discountPercent', parsed.data.discountPercent ?? inv.discountPercent ?? 0);
    inv.set('discountAmount', totals.discountAmount);
    inv.set('taxRate', parsed.data.taxRate ?? inv.taxRate ?? 0);
    inv.set('taxAmount', totals.taxAmount);
    inv.set('total', totals.total);
  }

  await inv.save();
  return apiOk({ data: serializeInvoice(inv.toObject() as Record<string, unknown>) });
});

export const DELETE = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Invoice not found', 404);
  }
  const inv = await Invoice.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!inv) return apiError('NOT_FOUND', 'Invoice not found', 404);

  // Only draft + void invoices can be soft-deleted from history. Sent / paid
  // require a Void first to leave a clean audit trail.
  if (inv.status !== 'draft' && inv.status !== 'void') {
    return apiError(
      'CONFLICT',
      `Cannot delete invoice in status "${inv.status}". Void it first.`,
      409,
    );
  }

  await inv.softDelete();
  return apiOk({ data: { _id: params.id } });
});
