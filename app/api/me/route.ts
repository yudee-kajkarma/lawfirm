import { withAuth } from '@/lib/auth/withAuth';
import { apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

export const GET = withAuth(async (_req, _ctx, { user }) => {
  return apiOk({ data: user });
});
