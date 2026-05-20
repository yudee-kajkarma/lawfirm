import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { CaseChecklist } from '@/lib/models/CaseChecklist';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { checklistUpdateSchema } from '@/lib/utils/validators/caseChecklist';

export const runtime = 'nodejs';

type Params = { id: string };

function serializeChecklistItem(doc: Record<string, unknown>) {
  const stringify = (v: unknown): string | null => (v == null ? null : String(v));
  const isoDate = (v: unknown): string | null =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  const isoDateRequired = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  return {
    _id: String(doc._id),
    caseId: String(doc.caseId),
    businessUnit: doc.businessUnit as string,
    title: doc.title as string,
    description: stringify(doc.description),
    completed: Boolean(doc.completed),
    completedAt: isoDate(doc.completedAt),
    completedBy: stringify(doc.completedBy),
    dueDate: isoDate(doc.dueDate),
    order: (doc.order as number) ?? 0,
    createdBy: stringify(doc.createdBy),
    updatedBy: stringify(doc.updatedBy),
    createdAt: isoDateRequired(doc.createdAt),
    updatedAt: isoDateRequired(doc.updatedAt),
  };
}

export const PATCH = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Checklist item not found', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = checklistUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid item data', 400, parsed.error.flatten());
  }

  const item = await CaseChecklist.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!item) return apiError('NOT_FOUND', 'Checklist item not found', 404);

  // Stamp / clear completion metadata when the toggle flips.
  if (parsed.data.completed === true && !item.completed) {
    item.set('completedAt', new Date());
    item.set('completedBy', user._id);
  } else if (parsed.data.completed === false && item.completed) {
    item.set('completedAt', null);
    item.set('completedBy', null);
  }

  Object.assign(item, parsed.data);
  await item.save();

  return apiOk({ data: serializeChecklistItem(item.toObject() as Record<string, unknown>) });
});

export const DELETE = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Checklist item not found', 404);
  }

  const item = await CaseChecklist.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!item) return apiError('NOT_FOUND', 'Checklist item not found', 404);

  await item.softDelete();
  return apiOk({ data: { _id: params.id } });
});
