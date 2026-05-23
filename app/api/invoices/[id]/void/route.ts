import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Invoice, serializeInvoice } from '@/lib/models/Invoice';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

/** Voids an invoice from any non-paid status. Stamps `voidedAt`. */
export const POST = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Invoice not found', 404);
  }
  const inv = await Invoice.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!inv) return apiError('NOT_FOUND', 'Invoice not found', 404);
  if (inv.status === 'paid') {
    return apiError('CONFLICT', 'Cannot void a paid invoice', 409);
  }
  if (inv.status === 'void') {
    return apiError('CONFLICT', 'Invoice is already void', 409);
  }

  inv.set('status', 'void');
  inv.set('voidedAt', new Date());
  await inv.save();

  return apiOk({ data: serializeInvoice(inv.toObject() as Record<string, unknown>) });
});
