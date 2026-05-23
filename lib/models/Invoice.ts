import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { INVOICE_STATUSES } from '../constants/enums';
import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';

const LineItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    /** Computed server-side as quantity * unitPrice; clients don't submit this. */
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ClientSnapshotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, default: null, trim: true, maxlength: 200 },
    companyName: { type: String, default: null, trim: true, maxlength: 200 },
    address: { type: String, default: null, maxlength: 1000 },
  },
  { _id: false },
);

const InvoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    title: { type: String, default: null, trim: true, maxlength: 200 },

    businessUnit: { type: String, required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null, index: true },

    /**
     * Snapshotted at create-time. An invoice is a frozen accounting record —
     * renaming the underlying Contact later doesn't rewrite history.
     */
    clientSnapshot: { type: ClientSnapshotSchema, required: true },

    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: 'draft',
      required: true,
      index: true,
    },

    /** ISO 4217 code: USD / EUR / GBP / INR (extend in form's whitelist). */
    currency: { type: String, required: true, default: 'USD', maxlength: 3 },

    issueDate: { type: Date, required: true, default: () => new Date() },
    dueDate: { type: Date, required: true },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    voidedAt: { type: Date, default: null },

    lineItems: { type: [LineItemSchema], default: [] },

    /** Computed: sum(lineItems.amount). */
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    /** User-entered 0–100. */
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    /** Computed: subtotal * discountPercent / 100. */
    discountAmount: { type: Number, default: 0, min: 0 },
    /** User-entered 0–100. */
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    /** Computed: (subtotal - discountAmount) * taxRate / 100. */
    taxAmount: { type: Number, default: 0, min: 0 },
    /** Computed: subtotal - discountAmount + taxAmount. */
    total: { type: Number, required: true, min: 0, default: 0 },

    notes: { type: String, default: null, maxlength: 5000 },
    internalNotes: { type: String, default: null, maxlength: 5000 },
  },
  { timestamps: true },
);

InvoiceSchema.plugin(softDeletePlugin);
InvoiceSchema.plugin(auditFieldsPlugin);
InvoiceSchema.plugin(auditLogPlugin, { collectionName: 'invoices' });

InvoiceSchema.index({ businessUnit: 1, status: 1, dueDate: 1 });
InvoiceSchema.index({ businessUnit: 1, clientId: 1 });
InvoiceSchema.index({ businessUnit: 1, caseId: 1 });
InvoiceSchema.index({ invoiceNumber: 'text', title: 'text' });

export type InvoiceDoc = InferSchemaType<typeof InvoiceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Invoice: Model<InvoiceDoc> =
  (mongoose.models.Invoice as Model<InvoiceDoc>) ??
  mongoose.model<InvoiceDoc>('Invoice', InvoiceSchema);

/** Computes whether the invoice should display as overdue right now. */
export function computeIsOverdue(args: {
  status: string;
  dueDate: Date | string | null;
}): boolean {
  if (args.status === 'paid' || args.status === 'void' || args.status === 'draft') return false;
  if (!args.dueDate) return false;
  return new Date(args.dueDate).getTime() < Date.now();
}

export function serializeInvoice(doc: Record<string, unknown>) {
  const stringify = (v: unknown): string | null => (v == null ? null : String(v));
  const isoDate = (v: unknown): string | null =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  const isoDateRequired = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);

  const status = doc.status as string;
  const dueDate = (doc.dueDate as Date | string | null | undefined) ?? null;
  const isOverdue = computeIsOverdue({ status, dueDate });
  // Display status — leave the persisted status alone; just present "overdue"
  // when sent + past-due so the UI doesn't have to redo this math.
  const displayStatus = isOverdue && status === 'sent' ? 'overdue' : status;

  const snap = doc.clientSnapshot as Record<string, unknown> | null | undefined;
  const lineItems = (doc.lineItems as Array<Record<string, unknown>> | undefined) ?? [];

  return {
    _id: String(doc._id),
    invoiceNumber: doc.invoiceNumber as string,
    title: stringify(doc.title),
    businessUnit: doc.businessUnit as string,
    clientId: String(doc.clientId),
    caseId: stringify(doc.caseId),
    clientSnapshot: snap
      ? {
          name: snap.name as string,
          email: (snap.email as string | null | undefined) ?? null,
          companyName: (snap.companyName as string | null | undefined) ?? null,
          address: (snap.address as string | null | undefined) ?? null,
        }
      : null,
    status: displayStatus,
    persistedStatus: status,
    isOverdue,
    currency: (doc.currency as string) ?? 'USD',
    issueDate: isoDateRequired(doc.issueDate),
    dueDate: isoDateRequired(doc.dueDate),
    sentAt: isoDate(doc.sentAt),
    paidAt: isoDate(doc.paidAt),
    voidedAt: isoDate(doc.voidedAt),
    lineItems: lineItems.map((li) => ({
      description: li.description as string,
      quantity: li.quantity as number,
      unitPrice: li.unitPrice as number,
      amount: li.amount as number,
    })),
    subtotal: (doc.subtotal as number) ?? 0,
    discountPercent: (doc.discountPercent as number) ?? 0,
    discountAmount: (doc.discountAmount as number) ?? 0,
    taxRate: (doc.taxRate as number) ?? 0,
    taxAmount: (doc.taxAmount as number) ?? 0,
    total: (doc.total as number) ?? 0,
    notes: stringify(doc.notes),
    internalNotes: stringify(doc.internalNotes),
    createdBy: stringify(doc.createdBy),
    updatedBy: stringify(doc.updatedBy),
    createdAt: isoDateRequired(doc.createdAt),
    updatedAt: isoDateRequired(doc.updatedAt),
  };
}
