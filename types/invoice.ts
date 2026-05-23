import type { InvoiceStatus } from '@/lib/constants/enums';
import type { SupportedCurrency } from '@/lib/utils/validators/invoice';

export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type InvoiceClientSnapshot = {
  name: string;
  email: string | null;
  companyName: string | null;
  address: string | null;
};

export type Invoice = {
  _id: string;
  invoiceNumber: string;
  title: string | null;
  businessUnit: string;
  clientId: string;
  caseId: string | null;
  clientSnapshot: InvoiceClientSnapshot | null;
  /** Display status — flips persisted 'sent' → 'overdue' when past due date. */
  status: InvoiceStatus;
  /** What's actually stored in Mongo. Mutate via the action endpoints. */
  persistedStatus: InvoiceStatus;
  isOverdue: boolean;
  currency: SupportedCurrency;
  issueDate: string;
  dueDate: string;
  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  internalNotes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceListMeta = { page: number; limit: number; total: number };

export type InvoiceListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
  clientId?: string;
  caseId?: string;
  businessUnit?: string;
  sort?: string;
};
