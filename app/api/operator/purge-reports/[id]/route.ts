import { isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { PurgeReport, serializePurgeReport } from '@/lib/models/PurgeReport';
import { verifyPurgeReport } from '@/lib/services/purgeReportSign';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withOperatorAuth<Params>(async (_req, { params }) => {
  if (!isValidObjectId(params.id)) return apiError('NOT_FOUND', 'Purge report not found', 404);
  await connectDb();

  const doc = await PurgeReport.findById(params.id).lean();
  if (!doc) return apiError('NOT_FOUND', 'Purge report not found', 404);

  const serialized = serializePurgeReport(doc as Record<string, unknown>);
  const hmacValid = verifyPurgeReport(
    {
      tenantId: serialized.tenantId,
      tenantSlug: serialized.tenantSlug,
      initialDeletes: serialized.initialDeletes,
      verification: serialized.verification,
    },
    serialized.hmac,
  );

  return apiOk({ data: { ...serialized, hmacValid } });
});
