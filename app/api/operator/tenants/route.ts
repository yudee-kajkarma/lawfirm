import { Types, isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';
import { apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GET = withOperatorAuth(async (req) => {
  await connectDb();
  const sp = req.nextUrl.searchParams;

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT));

  const filter: Record<string, unknown> = {};

  const status = sp.get('status');
  if (status) filter.status = status;

  const search = sp.get('search');
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: re }, { slug: re }, { ownerEmail: re }];
  }

  const cursor = sp.get('cursor');
  if (cursor && isValidObjectId(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await Tenant.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasNext = docs.length > limit;
  const items = hasNext ? docs.slice(0, limit) : docs;
  const nextCursor = hasNext ? String(items[items.length - 1]!._id) : null;

  const tenantIds = items.map((t) => t._id);
  // Per-tenant user count across the list page is unavoidable cross-tenant —
  // the operator console is the one place this is legitimate. tenantAggregate()
  // would scope to a single tenant, which is the wrong primitive here.
  // eslint-disable-next-line no-restricted-syntax -- operator console, cross-tenant by design
  const userCounts = await User.aggregate([
    { $match: { tenantId: { $in: tenantIds }, deletedAt: null } },
    { $group: { _id: '$tenantId', count: { $sum: 1 } } },
  ]);
  const countsByTenant = new Map<string, number>(
    userCounts.map((r: { _id: Types.ObjectId; count: number }) => [String(r._id), Number(r.count)]),
  );

  const data = items.map((t) => ({
    _id: String(t._id),
    name: String(t.name),
    slug: String(t.slug),
    status: t.status,
    ownerEmail: String(t.ownerEmail),
    suspendedAt: t.suspendedAt ? new Date(t.suspendedAt).toISOString() : null,
    purgeScheduledAt: t.purgeScheduledAt ? new Date(t.purgeScheduledAt).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    userCount: countsByTenant.get(String(t._id)) ?? 0,
  }));

  return apiOk({ data, meta: { cursor: nextCursor, limit } });
});
