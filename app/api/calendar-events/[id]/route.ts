import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { CalendarEvent, serializeCalendarEvent } from '@/lib/models/CalendarEvent';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { calendarEventUpdateSchema } from '@/lib/utils/validators/calendarEvent';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Event not found', 404);
  }
  const e = await CalendarEvent.findOne({ _id: params.id, ...scopedQuery(user) }).lean();
  if (!e) return apiError('NOT_FOUND', 'Event not found', 404);
  return apiOk({ data: serializeCalendarEvent(e as Record<string, unknown>) });
});

export const PATCH = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Event not found', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = calendarEventUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid event data', 400, parsed.error.flatten());
  }

  if (
    parsed.data.businessUnit &&
    !user.isAdmin &&
    !user.businessUnits.includes(parsed.data.businessUnit)
  ) {
    return apiError('FORBIDDEN', 'No access to target business unit', 403);
  }

  const e = await CalendarEvent.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!e) return apiError('NOT_FOUND', 'Event not found', 404);

  Object.assign(e, parsed.data);

  // Cross-field validation that the partial schema can't enforce on its own:
  // a partial patch with only `startsAt` could push it past the existing `endsAt`.
  if (e.endsAt <= e.startsAt) {
    return apiError('VALIDATION_ERROR', 'End must be after start', 400);
  }

  await e.save();
  return apiOk({ data: serializeCalendarEvent(e.toObject() as Record<string, unknown>) });
});

export const DELETE = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Event not found', 404);
  }
  const e = await CalendarEvent.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!e) return apiError('NOT_FOUND', 'Event not found', 404);
  await e.softDelete();
  return apiOk({ data: { _id: params.id } });
});
