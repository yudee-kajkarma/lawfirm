import type { NextRequest } from 'next/server';

import { auth } from '@/auth';

import { connectDb } from '../db/connect';
import { PlatformOperator } from '../models/PlatformOperator';
import { apiError } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import { runWithContext } from './requestContext';

export type HydratedOperator = {
  _id: string;
  email: string;
  name: string;
  // Deliberately NO tenantId. Calling scopedQuery(operator) is a TS error.
};

type RouteContext<TParams = Record<string, string | string[]>> = {
  params: Promise<TParams>;
};

type Handler<TParams = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: { params: TParams },
  meta: { operator: HydratedOperator },
) => Promise<Response> | Response;

/**
 * Operator-only API wrapper. Refuses anything that isn't a fresh
 * `kind: 'operator'` session and a still-active PlatformOperator.
 */
export function withOperatorAuth<TParams = Record<string, string | string[]>>(
  handler: Handler<TParams>,
) {
  return async (req: NextRequest, ctx: RouteContext<TParams>): Promise<Response> => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return apiError('UNAUTHORIZED', 'Not signed in', 401);
      }
      if (session.user.kind !== 'operator') {
        return apiError('FORBIDDEN', 'Operator access required', 403);
      }

      await connectDb();
      const opDoc = await PlatformOperator.findById(session.user.id);
      if (!opDoc || !opDoc.isActive) {
        return apiError('UNAUTHORIZED', 'Operator not found or inactive', 401);
      }

      const hydrated: HydratedOperator = {
        _id: opDoc._id.toString(),
        email: opDoc.email,
        name: opDoc.name,
      };

      const params = await ctx.params;

      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        undefined;
      const userAgent = req.headers.get('user-agent') ?? undefined;

      return await runWithContext(
        {
          user: null,
          operator: { _id: hydrated._id, email: hydrated.email },
          source: 'system',
          ip,
          userAgent,
        },
        async () => handler(req, { params }, { operator: hydrated }),
      );
    } catch (err) {
      if (err instanceof AppError) {
        return apiError(err.code, err.message, err.statusCode, err.details);
      }
      console.error('[withOperatorAuth] unhandled error', err);
      return apiError('INTERNAL_ERROR', 'Something went wrong', 500);
    }
  };
}
