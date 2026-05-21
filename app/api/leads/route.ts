import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Lead, serializeLead } from '@/lib/models/Lead';
import { applySmartList, mergeWithSmartList } from '@/lib/services/applySmartList';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { AppError } from '@/lib/utils/errors';
import { parseListQuery } from '@/lib/utils/parseListQuery';
import { leadCreateSchema } from '@/lib/utils/validators/lead';

export const runtime = 'nodejs';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GET = withAuth(async (req, _ctx, { user }) => {
  await connectDb();
  const list = parseListQuery(req);
  const sp = req.nextUrl.searchParams;

  const filter: Record<string, unknown> = { ...scopedQuery(user, list.businessUnit) };

  const stage = sp.get('stage');
  if (stage) filter.stage = stage;

  const source = sp.get('source');
  if (source) filter.source = source;

  if (list.assignedTo) filter.assignedTo = list.assignedTo;

  if (list.search) {
    const re = new RegExp(escapeRegex(list.search), 'i');
    filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { companyName: re }];
  }

  // Smart list overlay — $and-merged so it composes with URL filters.
  let finalFilter = filter;
  const smartListId = list.smartListId;
  if (smartListId) {
    try {
      const smartFilter = await applySmartList({ smartListId, expectedEntity: 'lead', user });
      finalFilter = mergeWithSmartList(filter, smartFilter);
    } catch (err) {
      if (err instanceof AppError) {
        return apiError(err.code, err.message, err.statusCode);
      }
      throw err;
    }
  }

  const skip = (list.page - 1) * list.limit;
  const sort: Record<string, 1 | -1> = { [list.sort.field]: list.sort.direction };

  const [items, total] = await Promise.all([
    Lead.find(finalFilter).sort(sort).skip(skip).limit(list.limit).lean(),
    Lead.countDocuments(finalFilter),
  ]);

  return apiOk({
    data: items.map((doc) => serializeLead(doc as Record<string, unknown>)),
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

  const parsed = leadCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid lead data', 400, parsed.error.flatten());
  }

  if (!user.isAdmin && !user.businessUnits.includes(parsed.data.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }

  const created = await Lead.create(parsed.data);
  return apiOk(
    { data: serializeLead(created.toObject() as Record<string, unknown>) },
    201,
  );
});
