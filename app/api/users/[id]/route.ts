import { isValidObjectId } from 'mongoose';

import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { User, serializeUser } from '@/lib/models/User';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { userUpdateSchema } from '@/lib/utils/validators/user';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(
  async (_req, { params }) => {
    await connectDb();
    if (!isValidObjectId(params.id)) {
      return apiError('NOT_FOUND', 'User not found', 404);
    }
    const doc = await User.findById(params.id).lean();
    if (!doc) return apiError('NOT_FOUND', 'User not found', 404);
    return apiOk({ data: serializeUser(doc as Record<string, unknown>) });
  },
  { adminOnly: true },
);

export const PATCH = withAuth<Params>(
  async (req, { params }, { user: actor }) => {
    await connectDb();
    if (!isValidObjectId(params.id)) {
      return apiError('NOT_FOUND', 'User not found', 404);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
    }

    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid user data', 400, parsed.error.flatten());
    }

    const target = await User.findById(params.id);
    if (!target) return apiError('NOT_FOUND', 'User not found', 404);

    const isSelf = target._id.toString() === actor._id;

    // Self-protection: admin can't lock themselves out of their own console.
    // They can edit their name/email/businessUnits/avatar — just not the two
    // fields that gate access.
    if (isSelf) {
      if (parsed.data.isAdmin === false) {
        return apiError(
          'FORBIDDEN',
          'You cannot remove admin from your own account. Ask another admin to do it.',
          403,
        );
      }
      if (parsed.data.isActive === false) {
        return apiError(
          'FORBIDDEN',
          'You cannot deactivate your own account.',
          403,
        );
      }
    }

    // If email is changing, ensure it's unique (excluding self).
    if (parsed.data.email && parsed.data.email !== target.email) {
      const clash = await User.findOne({
        email: parsed.data.email,
        _id: { $ne: target._id },
      }).setOptions({ withDeleted: true });
      if (clash) {
        return apiError('CONFLICT', 'A user with this email already exists', 409);
      }
    }

    Object.assign(target, parsed.data);
    await target.save();

    return apiOk({ data: serializeUser(target.toObject() as Record<string, unknown>) });
  },
  { adminOnly: true },
);
