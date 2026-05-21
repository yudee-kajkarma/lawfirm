import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { getDashboardMetrics } from '@/lib/services/dashboardMetrics';
import { apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

export const GET = withAuth(async (req, _ctx, { user }) => {
  await connectDb();
  const bu = req.nextUrl.searchParams.get('businessUnit');
  const metrics = await getDashboardMetrics(user, bu);
  return apiOk({ data: metrics });
});
