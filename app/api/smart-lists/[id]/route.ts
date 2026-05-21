import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { SmartList, serializeSmartList } from '@/lib/models/SmartList';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { ValidationError } from '@/lib/utils/errors';
import { translateFilterTree, type FilterTree } from '@/lib/utils/smartListQuery';
import type { SmartListEntity } from '@/lib/utils/smartListFields';
import { smartListUpdateSchema } from '@/lib/utils/validators/smartList';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Smart list not found', 404);
  }
  const sl = await SmartList.findOne({ _id: params.id, ...scopedQuery(user) }).lean();
  if (!sl) return apiError('NOT_FOUND', 'Smart list not found', 404);
  return apiOk({ data: serializeSmartList(sl as Record<string, unknown>) });
});

export const PATCH = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Smart list not found', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = smartListUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid smart list data', 400, parsed.error.flatten());
  }

  const sl = await SmartList.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!sl) return apiError('NOT_FOUND', 'Smart list not found', 404);

  // Dry-run the new filter tree against the (unchanged) entity's whitelist.
  if (parsed.data.filterTree) {
    try {
      translateFilterTree(
        parsed.data.filterTree as FilterTree,
        sl.entity as SmartListEntity,
      );
    } catch (err) {
      if (err instanceof ValidationError) {
        return apiError('VALIDATION_ERROR', err.message, 400);
      }
      throw err;
    }
  }

  Object.assign(sl, parsed.data);
  await sl.save();

  return apiOk({ data: serializeSmartList(sl.toObject() as Record<string, unknown>) });
});

export const DELETE = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Smart list not found', 404);
  }
  const sl = await SmartList.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!sl) return apiError('NOT_FOUND', 'Smart list not found', 404);
  await sl.softDelete();
  return apiOk({ data: { _id: params.id } });
});
