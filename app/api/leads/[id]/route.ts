import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Lead, serializeLead } from '@/lib/models/Lead';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { leadUpdateSchema } from '@/lib/utils/validators/lead';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Lead not found', 404);
  }
  const lead = await Lead.findOne({ _id: params.id, ...scopedQuery(user) }).lean();
  if (!lead) return apiError('NOT_FOUND', 'Lead not found', 404);
  return apiOk({ data: serializeLead(lead as Record<string, unknown>) });
});

export const PATCH = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Lead not found', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = leadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid lead data', 400, parsed.error.flatten());
  }

  if (
    parsed.data.businessUnit &&
    !user.isAdmin &&
    !user.businessUnits.includes(parsed.data.businessUnit)
  ) {
    return apiError('FORBIDDEN', 'No access to target business unit', 403);
  }

  // Fetch-then-save so the audit hooks fire (CLAUDE.md §3.3).
  const lead = await Lead.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!lead) return apiError('NOT_FOUND', 'Lead not found', 404);

  Object.assign(lead, parsed.data);
  await lead.save();

  return apiOk({ data: serializeLead(lead.toObject() as Record<string, unknown>) });
});

export const DELETE = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Lead not found', 404);
  }

  const lead = await Lead.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!lead) return apiError('NOT_FOUND', 'Lead not found', 404);

  await lead.softDelete();
  return apiOk({ data: { _id: params.id } });
});
