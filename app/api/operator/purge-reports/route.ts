import { Types, isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { PurgeReport, serializePurgeReport } from '@/lib/models/PurgeReport';
import { apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const GET = withOperatorAuth(async (req) => {
  await connectDb();
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT));

  const filter: Record<string, unknown> = {};

  const search = sp.get('search');
  if (search) filter.tenantSlug = new RegExp(search, 'i');

  const cursor = sp.get('cursor');
  if (cursor && isValidObjectId(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await PurgeReport.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasNext = docs.length > limit;
  const items = hasNext ? docs.slice(0, limit) : docs;
  const nextCursor = hasNext ? String(items[items.length - 1]!._id) : null;

  return apiOk({
    data: items.map((d) => serializePurgeReport(d as Record<string, unknown>)),
    meta: { cursor: nextCursor, limit },
  });
});
