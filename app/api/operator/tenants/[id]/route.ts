import { isValidObjectId } from 'mongoose';

import { withOperatorAuth } from '@/lib/auth/withOperatorAuth';
import { connectDb } from '@/lib/db/connect';
import { BusinessUnit } from '@/lib/models/BusinessUnit';
import { Case } from '@/lib/models/Case';
import { Contact } from '@/lib/models/Contact';
import { Invoice } from '@/lib/models/Invoice';
import { Lead } from '@/lib/models/Lead';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withOperatorAuth<Params>(async (_req, { params }) => {
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Tenant not found', 404);
  }
  await connectDb();

  const tenant = await Tenant.findById(params.id).lean();
  if (!tenant) return apiError('NOT_FOUND', 'Tenant not found', 404);

  const tid = tenant._id;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [bus, userCount, leadsTotal, leads7d, casesTotal, cases7d, contactsTotal, invoicesTotal] =
    await Promise.all([
      BusinessUnit.find({ tenantId: tid }).sort({ order: 1 }).lean(),
      User.countDocuments({ tenantId: tid }),
      Lead.countDocuments({ tenantId: tid }),
      Lead.countDocuments({ tenantId: tid, createdAt: { $gte: sevenDaysAgo } }),
      Case.countDocuments({ tenantId: tid }),
      Case.countDocuments({ tenantId: tid, createdAt: { $gte: sevenDaysAgo } }),
      Contact.countDocuments({ tenantId: tid }),
      Invoice.countDocuments({ tenantId: tid }),
    ]);

  return apiOk({
    data: {
      tenant: {
        _id: String(tenant._id),
        name: String(tenant.name),
        slug: String(tenant.slug),
        status: tenant.status,
        ownerEmail: String(tenant.ownerEmail),
        suspendedAt: tenant.suspendedAt ? new Date(tenant.suspendedAt).toISOString() : null,
        purgeScheduledAt: tenant.purgeScheduledAt
          ? new Date(tenant.purgeScheduledAt).toISOString()
          : null,
        createdAt: new Date(tenant.createdAt).toISOString(),
      },
      businessUnits: bus.map((b) => ({
        _id: String(b._id),
        key: String(b.key),
        name: String(b.name),
        color: String(b.color ?? '#64748b'),
        isActive: b.isActive !== false,
      })),
      counts: {
        users: userCount,
        leadsTotal,
        leads7d,
        casesTotal,
        cases7d,
        contactsTotal,
        invoicesTotal,
      },
    },
  });
});
