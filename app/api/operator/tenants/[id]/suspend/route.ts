import { isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { Tenant } from '@/lib/models/Tenant';
import { writeOperatorAudit } from '@/lib/services/operatorAudit';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

export const POST = withOperatorAuth<Params>(async (req, { params }, { operator }) => {
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Tenant not found', 404);
  }
  await connectDb();
  const tenant = await Tenant.findById(params.id);
  if (!tenant) return apiError('NOT_FOUND', 'Tenant not found', 404);
  if (tenant.status === 'pending_purge' || tenant.status === 'purging') {
    return apiError('CONFLICT', 'Tenant is already scheduled for purge', 409);
  }
  if (tenant.status === 'suspended') {
    return apiError('CONFLICT', 'Tenant is already suspended', 409);
  }

  tenant.status = 'suspended';
  tenant.suspendedAt = new Date();
  await tenant.save();

  await writeOperatorAudit({
    operator,
    action: 'suspend_tenant',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  });

  return apiOk({ data: { _id: String(tenant._id), status: tenant.status } });
});
