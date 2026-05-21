import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Task, serializeTask } from '@/lib/models/Task';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { taskUpdateSchema } from '@/lib/utils/validators/task';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Task not found', 404);
  }
  const t = await Task.findOne({ _id: params.id, ...scopedQuery(user) }).lean();
  if (!t) return apiError('NOT_FOUND', 'Task not found', 404);
  return apiOk({ data: serializeTask(t as Record<string, unknown>) });
});

export const PATCH = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Task not found', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid task data', 400, parsed.error.flatten());
  }

  if (
    parsed.data.businessUnit &&
    !user.isAdmin &&
    !user.businessUnits.includes(parsed.data.businessUnit)
  ) {
    return apiError('FORBIDDEN', 'No access to target business unit', 403);
  }

  const t = await Task.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!t) return apiError('NOT_FOUND', 'Task not found', 404);

  // Stamp / clear completion metadata when status transitions in/out of 'done'.
  if (parsed.data.status === 'done' && t.status !== 'done') {
    t.set('completedAt', new Date());
    t.set('completedBy', user._id);
  } else if (parsed.data.status && parsed.data.status !== 'done' && t.status === 'done') {
    t.set('completedAt', null);
    t.set('completedBy', null);
  }

  Object.assign(t, parsed.data);
  await t.save();

  return apiOk({ data: serializeTask(t.toObject() as Record<string, unknown>) });
});

export const DELETE = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Task not found', 404);
  }
  const t = await Task.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!t) return apiError('NOT_FOUND', 'Task not found', 404);
  await t.softDelete();
  return apiOk({ data: { _id: params.id } });
});
