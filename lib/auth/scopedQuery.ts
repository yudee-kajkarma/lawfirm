import { Types } from 'mongoose';

import { ForbiddenError } from '../utils/errors';
import type { HydratedUser } from './withAuth';

/**
 * Returns a Mongoose filter that constrains queries to the (tenant, BU) the
 * user can see. Always tenant-first. Combine into every find/findOne you write.
 *
 * Admin (within a tenant) behaviour:
 *   - No requestedBU (or 'all') → { tenantId }            (every BU in the tenant)
 *   - Specific requestedBU     → { tenantId, businessUnit }
 *
 * Non-admin behaviour:
 *   - No requestedBU (or 'all') → { tenantId, businessUnit: { $in: user.businessUnits } }
 *   - Specific BU they have    → { tenantId, businessUnit }
 *   - Specific BU they don't   → throws ForbiddenError
 *
 * Refuses if user has no tenantId — every authenticated user post-MT-1 does.
 *
 * Soft-delete is NOT included here — the softDeletePlugin handles that for
 * find/findOne/updateOne/etc. For aggregations, use `withSoftDeleteMatch()`.
 */
export function scopedQuery(
  user: HydratedUser,
  requestedBU?: string | null,
): Record<string, unknown> {
  if (!user.tenantId) {
    throw new ForbiddenError('User has no tenant');
  }
  const tenantId = new Types.ObjectId(user.tenantId);
  const wantsAll = !requestedBU || requestedBU === 'all';

  if (user.isAdmin) {
    return wantsAll ? { tenantId } : { tenantId, businessUnit: requestedBU };
  }

  if (user.businessUnits.length === 0) {
    throw new ForbiddenError('No business unit access');
  }

  if (wantsAll) {
    return { tenantId, businessUnit: { $in: user.businessUnits } };
  }

  if (!user.businessUnits.includes(requestedBU)) {
    throw new ForbiddenError(`No access to business unit '${requestedBU}'`);
  }

  return { tenantId, businessUnit: requestedBU };
}
