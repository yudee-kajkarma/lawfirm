import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '../auth/scopedQuery';
import type { HydratedUser } from '../auth/withAuth';
import { SmartList } from '../models/SmartList';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import type { SmartListEntity } from '../utils/smartListFields';
import { translateFilterTree, type FilterTree } from '../utils/smartListQuery';

/**
 * Combines a base list-route filter with the result of a Smart List filter
 * without key-collision risk. If the smart list produced nothing, returns
 * the base filter unchanged. Otherwise wraps both in `$and` so Mongo treats
 * them as independent constraints — solves "smart list says stage=qualified
 * but URL also has stage=lost" without one silently overwriting the other.
 */
export function mergeWithSmartList(
  base: Record<string, unknown>,
  smart: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.keys(smart).length === 0) return base;
  if (Object.keys(base).length === 0) return smart;
  return { $and: [base, smart] };
}

/**
 * Loads a Smart List, verifies the user can see it + that its entity matches
 * the caller's expectation, then translates its filter tree into a Mongo
 * filter object ready to merge into a `find()` query.
 *
 * Used by every list endpoint that accepts `?smartListId=`.
 */
export async function applySmartList(args: {
  smartListId: string;
  expectedEntity: SmartListEntity;
  user: HydratedUser;
}): Promise<Record<string, unknown>> {
  if (!isValidObjectId(args.smartListId)) {
    throw new NotFoundError('Smart list not found');
  }
  const sl = await SmartList.findOne({
    _id: args.smartListId,
    ...scopedQuery(args.user),
  }).lean();
  if (!sl) throw new NotFoundError('Smart list not found');
  if (sl.entity !== args.expectedEntity) {
    throw new ConflictError(
      `Smart list targets ${sl.entity}, not ${args.expectedEntity}`,
    );
  }
  // The persisted filterTree was validated at write time but the field/op
  // whitelist may have shifted since (a field could be removed). Re-translate
  // every read — cheap, and the only correct thing to do.
  try {
    return translateFilterTree(sl.filterTree as FilterTree, sl.entity as SmartListEntity);
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new ValidationError(`Smart list "${sl.name}" is invalid: ${err.message}`);
    }
    throw err;
  }
}
