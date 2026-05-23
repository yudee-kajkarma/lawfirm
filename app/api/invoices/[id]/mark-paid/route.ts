import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Invoice, serializeInvoice } from '@/lib/models/Invoice';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

export const POST = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Invoice not found', 404);
  }
  const inv = await Invoice.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!inv) return apiError('NOT_FOUND', 'Invoice not found', 404);
  if (inv.status !== 'sent') {
    return apiError(
      'CONFLICT',
      `Invoice is "${inv.status}" — only sent invoices can be marked paid.`,
      409,
    );
  }

  inv.set('status', 'paid');
  inv.set('paidAt', new Date());
  await inv.save();

  return apiOk({ data: serializeInvoice(inv.toObject() as Record<string, unknown>) });
});
