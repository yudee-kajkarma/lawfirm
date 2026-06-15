import { isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { Tenant } from '@/lib/models/Tenant';
import { writeOperatorAudit } from '@/lib/services/operatorAudit';
import {
  PurgeIneligible,
  PurgeIncomplete,
  purgeTenant,
} from '@/lib/services/purgeTenant';
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

  try {
    const outcome = await purgeTenant(tenant._id, {
      triggeredBy: 'operator',
      operatorId: operator._id,
      operatorEmail: operator.email,
    });

    await writeOperatorAudit({
      operator,
      action: 'purge_now',
      targetTenant: { _id: tenant._id, slug: tenant.slug },
      details: { reportId: outcome.reportId, deletes: outcome.initialDeletes, s3: outcome.s3 },
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    });

    return apiOk({ data: { reportId: outcome.reportId } });
  } catch (err) {
    if (err instanceof PurgeIneligible) {
      return apiError('CONFLICT', err.message, 409);
    }
    if (err instanceof PurgeIncomplete) {
      console.error('[purge-now] verification failed', { tenantId: tenant._id.toString(), verification: err.verification });
      return apiError('PURGE_INCOMPLETE', err.message, 500, { verification: err.verification });
    }
    throw err;
  }
});
