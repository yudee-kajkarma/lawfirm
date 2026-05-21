import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { POLY_RELATED_TYPES } from '@/lib/constants/enums';
import { Task, serializeTask } from '@/lib/models/Task';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { isValidObjectIdString } from '@/lib/utils/objectId';
import { parseListQuery } from '@/lib/utils/parseListQuery';
import { taskCreateSchema } from '@/lib/utils/validators/task';

export const runtime = 'nodejs';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GET = withAuth(async (req, _ctx, { user }) => {
  await connectDb();
  const list = parseListQuery(req);
  const sp = req.nextUrl.searchParams;

  const filter: Record<string, unknown> = { ...scopedQuery(user, list.businessUnit) };

  const status = sp.get('status');
  if (status) filter.status = status;

  const priority = sp.get('priority');
  if (priority) filter.priority = priority;

  if (list.assignedTo) filter.assignedTo = list.assignedTo;

  // Polymorphic attach filter — used by the embedded TasksPanel.
  const relType = sp.get('relatedToType');
  const relId = sp.get('relatedToId');
  if (relType && relId) {
    if (!(POLY_RELATED_TYPES as readonly string[]).includes(relType) || !isValidObjectIdString(relId)) {
      return apiError('VALIDATION_ERROR', 'Invalid relatedTo filter', 400);
    }
    filter['relatedTo.type'] = relType;
    filter['relatedTo.id'] = relId;
  }

  // Overdue: due date past + status not terminal.
  if (sp.get('overdue') === 'true') {
    filter.dueDate = { $ne: null, $lt: new Date() };
    filter.status = { $nin: ['done', 'cancelled'] };
  }

  if (list.search) {
    const re = new RegExp(escapeRegex(list.search), 'i');
    filter.$or = [{ title: re }, { description: re }];
  }

  const skip = (list.page - 1) * list.limit;
  // Default sort for tasks favors near-due-then-recent rather than purely creation time.
  const sortField = list.sort.field === 'createdAt' ? 'dueDate' : list.sort.field;
  const sort: Record<string, 1 | -1> = { [sortField]: list.sort.direction };

  const [items, total] = await Promise.all([
    Task.find(filter).sort(sort).skip(skip).limit(list.limit).lean(),
    Task.countDocuments(filter),
  ]);

  return apiOk({
    data: items.map((doc) => serializeTask(doc as Record<string, unknown>)),
    meta: { page: list.page, limit: list.limit, total },
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

  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid task data', 400, parsed.error.flatten());
  }

  if (!user.isAdmin && !user.businessUnits.includes(parsed.data.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }

  const created = await Task.create(parsed.data);
  return apiOk({ data: serializeTask(created.toObject() as Record<string, unknown>) }, 201);
});
