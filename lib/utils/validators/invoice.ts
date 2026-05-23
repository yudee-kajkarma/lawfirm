import { z } from 'zod';

import { INVOICE_STATUSES } from '@/lib/constants/enums';
import { isValidObjectIdString } from '@/lib/utils/objectId';

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

const objectIdString = z.string().refine(isValidObjectIdString, { message: 'Invalid id' });

/** Currencies we'll let the picker offer in v1. Add more by extending here. */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const dateInput = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce.date(),
);

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().min(0).max(1_000_000).finite(),
  unitPrice: z.coerce.number().min(0).max(10_000_000).finite(),
});

export const invoiceCreateSchema = z.object({
  title: trimmedString(200).nullish(),
  businessUnit: z.string().min(1),
  clientId: objectIdString,
  caseId: objectIdString.nullish(),
  currency: z.enum(SUPPORTED_CURRENCIES).default('USD'),
  issueDate: dateInput.optional(),
  dueDate: dateInput,
  lineItems: z.array(lineItemSchema).min(1, 'Add at least one line item'),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: trimmedString(5000).nullish(),
  internalNotes: trimmedString(5000).nullish(),
});

// Re-declare every defaulted field as `.optional()` after `.partial()` so a
// PATCH doesn't silently overwrite them — see project-zod-partial-defaults.
export const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

export const invoiceStatusActionSchema = z.object({
  // Currently no body needed for send/mark-paid/void, but reserved for future
  // (e.g., manual sentAt override). Accepts an empty object.
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type InvoiceLineItemInput = z.infer<typeof lineItemSchema>;

export const INVOICE_TERMINAL_STATUSES = ['paid', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
