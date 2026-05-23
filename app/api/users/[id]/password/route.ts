import { isValidObjectId } from 'mongoose';

import { hashPassword } from '@/lib/auth/password';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { User } from '@/lib/models/User';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { userPasswordSchema } from '@/lib/utils/validators/user';

export const runtime = 'nodejs';

type Params = { id: string };

export const POST = withAuth<Params>(
  async (req, { params }) => {
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

    const parsed = userPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid password', 400, parsed.error.flatten());
    }

    const target = await User.findById(params.id);
    if (!target) return apiError('NOT_FOUND', 'User not found', 404);

    target.passwordHash = await hashPassword(parsed.data.password);
    await target.save();

    return apiOk({ data: { _id: target._id.toString() } });
  },
  { adminOnly: true },
);
