import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Case } from '@/lib/models/Case';
import { Contact } from '@/lib/models/Contact';
import { Invoice, serializeInvoice } from '@/lib/models/Invoice';
import { generateInvoiceNumber } from '@/lib/services/invoiceNumber';
import { computeInvoiceTotals } from '@/lib/services/invoiceTotals';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { parseListQuery } from '@/lib/utils/parseListQuery';
import { invoiceCreateSchema } from '@/lib/utils/validators/invoice';

export const runtime = 'nodejs';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GET = withAuth(async (req, _ctx, { user }) => {
  await connectDb();
  const list = parseListQuery(req);
  const sp = req.nextUrl.searchParams;

  const filter: Record<string, unknown> = { ...scopedQuery(user, list.businessUnit) };

  const status = sp.get('status');
  if (status) filter.status = status;

  const clientId = sp.get('clientId');
  if (clientId) filter.clientId = clientId;

  const caseId = sp.get('caseId');
  if (caseId) filter.caseId = caseId;

  if (list.search) {
    const re = new RegExp(escapeRegex(list.search), 'i');
    filter.$or = [{ invoiceNumber: re }, { title: re }];
  }

  const skip = (list.page - 1) * list.limit;
  // Default sort: most-recent issue date first, then creation.
  const sortField = list.sort.field === 'createdAt' ? 'issueDate' : list.sort.field;
  const sort: Record<string, 1 | -1> = { [sortField]: list.sort.direction };

  const [items, total] = await Promise.all([
    Invoice.find(filter).sort(sort).skip(skip).limit(list.limit).lean(),
    Invoice.countDocuments(filter),
  ]);

  return apiOk({
    data: items.map((doc) => serializeInvoice(doc as Record<string, unknown>)),
    meta: { page: list.page, limit: list.limit, total },
  });
});

export const POST = withAuth(async (req, _ctx, { user }) => {
  await connectDb();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid invoice data', 400, parsed.error.flatten());
  }

  if (!user.isAdmin && !user.businessUnits.includes(parsed.data.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }

  // Verify the client + (optional) case exist and live in the same BU. Same
  // scoping rules as everywhere else.
  const client = await Contact.findOne({
    _id: parsed.data.clientId,
    ...scopedQuery(user),
  }).lean();
  if (!client) return apiError('VALIDATION_ERROR', 'Client contact not found', 400);
  if (client.businessUnit !== parsed.data.businessUnit) {
    return apiError(
      'VALIDATION_ERROR',
      'Client belongs to a different business unit',
      400,
    );
  }

  if (parsed.data.caseId) {
    const c = await Case.findOne({ _id: parsed.data.caseId, ...scopedQuery(user) }).lean();
    if (!c) return apiError('VALIDATION_ERROR', 'Case not found', 400);
    if (c.businessUnit !== parsed.data.businessUnit) {
      return apiError(
        'VALIDATION_ERROR',
        'Case belongs to a different business unit',
        400,
      );
    }
  }

  // Compute totals server-side — clients can't tamper.
  const totals = computeInvoiceTotals({
    lineItems: parsed.data.lineItems,
    discountPercent: parsed.data.discountPercent,
    taxRate: parsed.data.taxRate,
  });

  const invoiceNumber = await generateInvoiceNumber(parsed.data.businessUnit);

  const created = await Invoice.create({
    title: parsed.data.title ?? null,
    businessUnit: parsed.data.businessUnit,
    clientId: parsed.data.clientId,
    caseId: parsed.data.caseId ?? null,
    clientSnapshot: {
      name: `${(client as { firstName: string }).firstName} ${(client as { lastName: string }).lastName}`.trim(),
      email: (client as { email: string | null }).email ?? null,
      companyName: (client as { companyName: string | null }).companyName ?? null,
      address: null, // address is a structured subdoc on Contact; flatten later if needed
    },
    status: 'draft',
    currency: parsed.data.currency,
    issueDate: parsed.data.issueDate ?? new Date(),
    dueDate: parsed.data.dueDate,
    lineItems: totals.lineItems,
    subtotal: totals.subtotal,
    discountPercent: parsed.data.discountPercent ?? 0,
    discountAmount: totals.discountAmount,
    taxRate: parsed.data.taxRate ?? 0,
    taxAmount: totals.taxAmount,
    total: totals.total,
    notes: parsed.data.notes ?? null,
    internalNotes: parsed.data.internalNotes ?? null,
    invoiceNumber,
  });

  return apiOk(
    { data: serializeInvoice(created.toObject() as Record<string, unknown>) },
    201,
  );
});
