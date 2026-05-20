import { ForbiddenError } from '../utils/errors';
import type { HydratedUser } from './withAuth';

/**
 * Returns a Mongoose filter that constrains queries to the BUs the user can
 * see. Combine into every `find()` / `findOne()` you write.
 *
 * Admin behaviour:
 *   - No `requestedBU` (or `'all'`)         → `{}`              (all BUs)
 *   - Specific `requestedBU`                → `{ businessUnit }`
 *
 * Non-admin behaviour:
 *   - No `requestedBU` (or `'all'`)         → `{ businessUnit: { $in: user.businessUnits } }`
 *   - Specific BU they have access to       → `{ businessUnit }`
 *   - Specific BU they DON'T have access to → throws ForbiddenError
 *
 * Soft-delete is NOT included here — the softDeletePlugin handles that for
 * find/findOne/updateOne/etc. For aggregations, use `withSoftDeleteMatch()`.
 */
export function scopedQuery(
  user: HydratedUser,
  requestedBU?: string | null,
): Record<string, unknown> {
  const wantsAll = !requestedBU || requestedBU === 'all';

  if (user.isAdmin) {
    return wantsAll ? {} : { businessUnit: requestedBU };
  }

  if (user.businessUnits.length === 0) {
    throw new ForbiddenError('No business unit access');
  }

  if (wantsAll) {
    return { businessUnit: { $in: user.businessUnits } };
  }

  if (!user.businessUnits.includes(requestedBU)) {
    throw new ForbiddenError(`No access to business unit '${requestedBU}'`);
  }

  return { businessUnit: requestedBU };
}
