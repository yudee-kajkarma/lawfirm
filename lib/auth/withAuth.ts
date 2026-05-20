import type { NextRequest } from 'next/server';

import { auth } from '@/auth';

import { connectDb } from '../db/connect';
import { User } from '../models/User';
import { apiError } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import { runWithContext } from './requestContext';

export type HydratedUser = {
  _id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  businessUnits: string[];
};

type RouteContext<TParams = Record<string, string | string[]>> = {
  params: Promise<TParams>;
};

type Handler<TParams = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: { params: TParams },
  meta: { user: HydratedUser },
) => Promise<Response> | Response;

type Options = { adminOnly?: boolean };

export function withAuth<TParams = Record<string, string | string[]>>(
  handler: Handler<TParams>,
  options: Options = {},
) {
  return async (req: NextRequest, ctx: RouteContext<TParams>): Promise<Response> => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return apiError('UNAUTHORIZED', 'Not signed in', 401);
      }

      await connectDb();
      const userDoc = await User.findById(session.user.id);
      if (!userDoc || !userDoc.isActive) {
        return apiError('UNAUTHORIZED', 'User not found or inactive', 401);
      }

      if (options.adminOnly && !userDoc.isAdmin) {
        return apiError('FORBIDDEN', 'Admin access required', 403);
      }

      const hydrated: HydratedUser = {
        _id: userDoc._id.toString(),
        email: userDoc.email,
        name: userDoc.name,
        isAdmin: userDoc.isAdmin,
        businessUnits: userDoc.businessUnits,
      };

      const params = await ctx.params;

      // Trust proxy-set headers in production; for self-host, set up the
      // reverse proxy to send `x-forwarded-for` / `x-real-ip`.
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        undefined;
      const userAgent = req.headers.get('user-agent') ?? undefined;

      return await runWithContext(
        {
          user: {
            _id: hydrated._id,
            email: hydrated.email,
            isAdmin: hydrated.isAdmin,
            businessUnits: hydrated.businessUnits,
          },
          source: 'user',
          ip,
          userAgent,
        },
        async () => handler(req, { params }, { user: hydrated }),
      );
    } catch (err) {
      if (err instanceof AppError) {
        return apiError(err.code, err.message, err.statusCode, err.details);
      }
      console.error('[withAuth] unhandled error', err);
      return apiError('INTERNAL_ERROR', 'Something went wrong', 500);
    }
  };
}
