import { Types, isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { OPERATOR_AUDIT_ACTIONS } from '@/lib/constants/enums';
import { OperatorAuditLog, serializeOperatorAuditLog } from '@/lib/models/OperatorAuditLog';
import { apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const GET = withOperatorAuth(async (req) => {
  await connectDb();
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT));

  const filter: Record<string, unknown> = {};

  const action = sp.get('action');
  if (action && (OPERATOR_AUDIT_ACTIONS as readonly string[]).includes(action)) {
    filter.action = action;
  }

  const operatorEmail = sp.get('operatorEmail');
  if (operatorEmail) filter.operatorEmail = new RegExp(operatorEmail, 'i');

  const cursor = sp.get('cursor');
  if (cursor && isValidObjectId(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await OperatorAuditLog.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasNext = docs.length > limit;
  const items = hasNext ? docs.slice(0, limit) : docs;
  const nextCursor = hasNext ? String(items[items.length - 1]!._id) : null;

  return apiOk({
    data: items.map((d) => serializeOperatorAuditLog(d as Record<string, unknown>)),
    meta: { cursor: nextCursor, limit },
  });
});
