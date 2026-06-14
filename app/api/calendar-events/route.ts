import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { POLY_RELATED_TYPES } from '@/lib/constants/enums';
import { CalendarEvent, serializeCalendarEvent } from '@/lib/models/CalendarEvent';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { isValidObjectIdString } from '@/lib/utils/objectId';
import { calendarEventCreateSchema } from '@/lib/utils/validators/calendarEvent';

export const runtime = 'nodejs';

export const GET = withAuth(async (req, _ctx, { user }) => {
  await connectDb();
  const sp = req.nextUrl.searchParams;

  const buParam = sp.get('businessUnit');
  const filter: Record<string, unknown> = { ...scopedQuery(user, buParam) };

  // Date-range overlap: event.startsAt < range.end AND event.endsAt > range.start.
  // Catches events partially within the visible window as well as fully inside.
  const startParam = sp.get('start');
  const endParam = sp.get('end');
  if (startParam && endParam) {
    const start = new Date(startParam);
    const end = new Date(endParam);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return apiError('VALIDATION_ERROR', 'Invalid start/end query params', 400);
    }
    filter.startsAt = { $lt: end };
    filter.endsAt = { $gt: start };
  }

  // Polymorphic filter — used by attached-events views on detail pages later.
  const relType = sp.get('relatedToType');
  const relId = sp.get('relatedToId');
  if (relType && relId) {
    if (
      !(POLY_RELATED_TYPES as readonly string[]).includes(relType) ||
      !isValidObjectIdString(relId)
    ) {
      return apiError('VALIDATION_ERROR', 'Invalid relatedTo filter', 400);
    }
    filter['relatedTo.type'] = relType;
    filter['relatedTo.id'] = relId;
  }

  const items = await CalendarEvent.find(filter).sort({ startsAt: 1 }).limit(500).lean();

  return apiOk({
    data: items.map((doc) => serializeCalendarEvent(doc as Record<string, unknown>)),
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

  const parsed = calendarEventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid event data', 400, parsed.error.flatten());
  }

  if (!user.isAdmin && !user.businessUnits.includes(parsed.data.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }

  const created = await CalendarEvent.create({ ...parsed.data, tenantId: user.tenantId });
  return apiOk(
    { data: serializeCalendarEvent(created.toObject() as Record<string, unknown>) },
    201,
  );
});
