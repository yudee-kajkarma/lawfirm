import { isValidObjectId, Types } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Case } from '@/lib/models/Case';
import { CaseChecklist } from '@/lib/models/CaseChecklist';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { checklistCreateSchema } from '@/lib/utils/validators/caseChecklist';

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

export const GET = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Case not found', 404);
  }

  // Verify the parent case is in user's scope before returning its checklist —
  // belt-and-suspenders since the checklist itself also carries businessUnit.
  const parent = await Case.findOne({ _id: params.id, ...scopedQuery(user) })
    .select('_id')
    .lean();
  if (!parent) return apiError('NOT_FOUND', 'Case not found', 404);

  const items = await CaseChecklist.find({ caseId: params.id, ...scopedQuery(user) })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return apiOk({
    data: items.map((doc) => serializeChecklistItem(doc as Record<string, unknown>)),
  });
});

export const POST = withAuth<Params>(async (req, { params }, { user }) => {
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

  const parsed = checklistCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid item data', 400, parsed.error.flatten());
  }

  const parent = await Case.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!parent) return apiError('NOT_FOUND', 'Case not found', 404);

  const item = await CaseChecklist.create({
    caseId: new Types.ObjectId(params.id),
    businessUnit: parent.businessUnit,
    ...parsed.data,
  });

  return apiOk(
    { data: serializeChecklistItem(item.toObject() as Record<string, unknown>) },
    201,
  );
});
