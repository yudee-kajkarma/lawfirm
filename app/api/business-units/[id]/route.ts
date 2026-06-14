import { isValidObjectId } from 'mongoose';

import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { BusinessUnit, serializeBusinessUnit } from '@/lib/models/BusinessUnit';
import { User } from '@/lib/models/User';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { businessUnitUpdateSchema } from '@/lib/utils/validators/businessUnit';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(
  async (_req, { params }, { user }) => {
    await connectDb();
    if (!isValidObjectId(params.id)) {
      return apiError('NOT_FOUND', 'Business unit not found', 404);
    }
    // Combine _id with tenantId — returns 404 for another tenant's doc rather
    // than 403 to avoid leaking that the ID exists at all.
    const doc = await BusinessUnit.findOne({ _id: params.id, tenantId: user.tenantId }).lean();
    if (!doc) return apiError('NOT_FOUND', 'Business unit not found', 404);
    return apiOk({ data: serializeBusinessUnit(doc as Record<string, unknown>) });
  },
  { adminOnly: true },
);

export const PATCH = withAuth<Params>(
  async (req, { params }, { user }) => {
    await connectDb();
    if (!isValidObjectId(params.id)) {
      return apiError('NOT_FOUND', 'Business unit not found', 404);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
    }

    const parsed = businessUnitUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_ERROR',
        'Invalid business unit data',
        400,
        parsed.error.flatten(),
      );
    }

    // Combine _id with tenantId — returns 404 for another tenant's doc.
    const target = await BusinessUnit.findOne({ _id: params.id, tenantId: user.tenantId });
    if (!target) return apiError('NOT_FOUND', 'Business unit not found', 404);

    const force = req.nextUrl.searchParams.get('force') === 'true';
    const isBeingDeactivated = parsed.data.isActive === false && target.isActive;

    if (isBeingDeactivated) {
      // Always-on guard: never allow zero active BUs within this tenant.
      const activeCount = await BusinessUnit.countDocuments({
        tenantId: user.tenantId,
        isActive: true,
      });
      if (activeCount <= 1) {
        return apiError(
          'CONFLICT',
          'You cannot deactivate the last active business unit.',
          409,
        );
      }

      // Soft guard: surface non-admin users within this tenant who'd lose all
      // UI access. Admin can proceed by re-sending with ?force=true.
      if (!force) {
        const orphaned = await User.find({
          tenantId: user.tenantId,
          isAdmin: false,
          isActive: true,
          businessUnits: [target.key],
        })
          .select('name email')
          .limit(50)
          .lean();
        if (orphaned.length > 0) {
          return apiError(
            'BU_HAS_SOLE_ACCESS_USERS',
            `${orphaned.length} active user${orphaned.length === 1 ? ' has' : 's have'} this as their only business unit.`,
            409,
            {
              affectedUserCount: orphaned.length,
              affectedUsers: orphaned.map((u) => ({
                _id: String(u._id),
                name: u.name,
                email: u.email,
              })),
            },
          );
        }
      }
    }

    Object.assign(target, parsed.data);
    await target.save();

    return apiOk({
      data: serializeBusinessUnit(target.toObject() as Record<string, unknown>),
    });
  },
  { adminOnly: true },
);
