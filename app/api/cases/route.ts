import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Case, serializeCase } from '@/lib/models/Case';
import { applySmartList, mergeWithSmartList } from '@/lib/services/applySmartList';
import { generateCaseNumber } from '@/lib/services/caseNumber';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { AppError } from '@/lib/utils/errors';
import { parseListQuery } from '@/lib/utils/parseListQuery';
import { caseCreateSchema } from '@/lib/utils/validators/case';

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

  if (list.assignedTo) filter.assignedTo = list.assignedTo;
  const clientId = sp.get('clientId');
  if (clientId) filter.clientId = clientId;

  if (list.search) {
    const re = new RegExp(escapeRegex(list.search), 'i');
    filter.$or = [{ caseNumber: re }, { title: re }, { description: re }];
  }

  let finalFilter = filter;
  if (list.smartListId) {
    try {
      const smartFilter = await applySmartList({
        smartListId: list.smartListId,
        expectedEntity: 'case',
        user,
      });
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
    Case.find(finalFilter).sort(sort).skip(skip).limit(list.limit).lean(),
    Case.countDocuments(finalFilter),
  ]);

  return apiOk({
    data: items.map((doc) => serializeCase(doc as Record<string, unknown>)),
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

  const parsed = caseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid case data', 400, parsed.error.flatten());
  }

  if (!user.isAdmin && !user.businessUnits.includes(parsed.data.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }

  // Non-transactional path — direct case create gets a number from the
  // atomic counter but without rollback guarantees. The lead-conversion
  // route uses the same counter inside a transaction.
  const caseNumber = await generateCaseNumber(user.tenantId, parsed.data.businessUnit);
  const created = await Case.create({
    ...parsed.data,
    caseNumber,
    tenantId: user.tenantId,
  });

  return apiOk({ data: serializeCase(created.toObject() as Record<string, unknown>) }, 201);
});
