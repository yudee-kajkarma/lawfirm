import { Types, isValidObjectId } from 'mongoose';

import { withAuth } from '@/lib/auth/withAuth';
import { AUDIT_ACTIONS, AUDIT_SOURCES } from '@/lib/constants/enums';
import { connectDb } from '@/lib/db/connect';
import { AuditLog, serializeAuditLog } from '@/lib/models/AuditLog';
import { apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export const GET = withAuth(
  async (req) => {
    await connectDb();
    const sp = req.nextUrl.searchParams;

    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT),
    );

    const filter: Record<string, unknown> = {};

    const collectionName = sp.get('collectionName');
    if (collectionName) filter.collectionName = collectionName;

    const action = sp.get('action');
    if (action && (AUDIT_ACTIONS as readonly string[]).includes(action)) {
      filter.action = action;
    }

    const source = sp.get('source');
    if (source && (AUDIT_SOURCES as readonly string[]).includes(source)) {
      filter.source = source;
    }

    const businessUnit = sp.get('businessUnit');
    if (businessUnit) filter.businessUnit = businessUnit;

    const actorEmail = sp.get('actorEmail');
    if (actorEmail) {
      filter.actorEmail = new RegExp(escapeRegex(actorEmail), 'i');
    }

    const from = parseIsoDate(sp.get('from'));
    const to = parseIsoDate(sp.get('to'));
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = from;
      // Treat the `to` param as end-of-day so a YYYY-MM-DD value covers the
      // whole day, not just midnight UTC.
      if (to) range.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
      filter.createdAt = range;
    }

    // Cursor pagination: callers pass the _id of the last row from the
    // previous page. `_id < cursor` (descending sort) walks backwards in time.
    const cursor = sp.get('cursor');
    if (cursor && isValidObjectId(cursor)) {
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    // Fetch limit+1 to know if there's a next page without doing a separate
    // count — important for an audit log that can grow to millions of rows.
    const docs = await AuditLog.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasNext = docs.length > limit;
    const items = hasNext ? docs.slice(0, limit) : docs;
    const nextCursor = hasNext ? String(items[items.length - 1]!._id) : null;

    return apiOk({
      data: items.map((doc) => serializeAuditLog(doc as Record<string, unknown>)),
      meta: { cursor: nextCursor, limit },
    });
  },
  { adminOnly: true },
);
