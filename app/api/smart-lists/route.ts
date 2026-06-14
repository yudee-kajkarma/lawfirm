import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { SmartList, serializeSmartList } from '@/lib/models/SmartList';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { ValidationError } from '@/lib/utils/errors';
import {
  SMART_LIST_ENTITIES,
  type SmartListEntity,
} from '@/lib/utils/smartListFields';
import { translateFilterTree, type FilterTree } from '@/lib/utils/smartListQuery';
import { smartListCreateSchema } from '@/lib/utils/validators/smartList';

export const runtime = 'nodejs';

export const GET = withAuth(async (req, _ctx, { user }) => {
  await connectDb();
  const sp = req.nextUrl.searchParams;

  const buParam = sp.get('businessUnit');
  const filter: Record<string, unknown> = { ...scopedQuery(user, buParam) };

  const entity = sp.get('entity');
  if (entity) {
    if (!(SMART_LIST_ENTITIES as readonly string[]).includes(entity)) {
      return apiError('VALIDATION_ERROR', 'Invalid entity', 400);
    }
    filter.entity = entity;
  }

  const items = await SmartList.find(filter).sort({ entity: 1, name: 1 }).lean();
  return apiOk({
    data: items.map((doc) => serializeSmartList(doc as Record<string, unknown>)),
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

  const parsed = smartListCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid smart list data', 400, parsed.error.flatten());
  }

  if (!user.isAdmin && !user.businessUnits.includes(parsed.data.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }

  // Dry-run the filter tree against the whitelist before persisting — saves
  // a confused user from saving an unusable smart list.
  try {
    translateFilterTree(parsed.data.filterTree as FilterTree, parsed.data.entity as SmartListEntity);
  } catch (err) {
    if (err instanceof ValidationError) {
      return apiError('VALIDATION_ERROR', err.message, 400);
    }
    throw err;
  }

  const created = await SmartList.create({ ...parsed.data, tenantId: user.tenantId });
  return apiOk(
    { data: serializeSmartList(created.toObject() as Record<string, unknown>) },
    201,
  );
});
