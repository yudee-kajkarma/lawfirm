import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Case, serializeCase } from '@/lib/models/Case';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { caseUpdateSchema } from '@/lib/utils/validators/case';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Case not found', 404);
  }
  const c = await Case.findOne({ _id: params.id, ...scopedQuery(user) }).lean();
  if (!c) return apiError('NOT_FOUND', 'Case not found', 404);
  return apiOk({ data: serializeCase(c as Record<string, unknown>) });
});

export const PATCH = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Case not found', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = caseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid case data', 400, parsed.error.flatten());
  }

  if (
    parsed.data.businessUnit &&
    !user.isAdmin &&
    !user.businessUnits.includes(parsed.data.businessUnit)
  ) {
    return apiError('FORBIDDEN', 'No access to target business unit', 403);
  }

  const c = await Case.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!c) return apiError('NOT_FOUND', 'Case not found', 404);

  // Auto-stamp closedAt when status transitions to 'closed'; clear it on reopen.
  if (parsed.data.status === 'closed' && c.status !== 'closed') {
    c.set('closedAt', new Date());
  } else if (parsed.data.status && parsed.data.status !== 'closed' && c.status === 'closed') {
    c.set('closedAt', null);
  }

  Object.assign(c, parsed.data);
  await c.save();

  return apiOk({ data: serializeCase(c.toObject() as Record<string, unknown>) });
});

export const DELETE = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Case not found', 404);
  }
  const c = await Case.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!c) return apiError('NOT_FOUND', 'Case not found', 404);
  await c.softDelete();
  return apiOk({ data: { _id: params.id } });
});
