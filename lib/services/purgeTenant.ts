import type { Types } from 'mongoose';

import { connectDb } from '@/lib/db/connect';
import { PurgeReport } from '@/lib/models/PurgeReport';
import { Tenant, type TenantDoc } from '@/lib/models/Tenant';
import { TENANT_MODELS } from '@/lib/tenancy/tenantModels';

import { s3CleanupForTenant, type S3CleanupResult } from './s3TenantCleanup';
import { signPurgeReport } from './purgeReportSign';

export type PurgeTrigger = 'cron' | 'operator';

export type PurgeContext = {
  triggeredBy: PurgeTrigger;
  operatorId?: string | null;
  operatorEmail?: string | null;
};

export class PurgeIneligible extends Error {
  constructor(message: string) { super(message); this.name = 'PurgeIneligible'; }
}
export class PurgeIncomplete extends Error {
  constructor(
    message: string,
    public verification: Record<string, number>,
  ) { super(message); this.name = 'PurgeIncomplete'; }
}

export type PurgeOutcome = {
  reportId: string;
  initialDeletes: Record<string, number>;
  verification: Record<string, number>;
  s3: S3CleanupResult;
};

/**
 * Purge one tenant. Idempotent: re-running on a tenant stuck in 'purging'
 * (crash recovery) repeats the sweep + verification and produces a clean
 * zero-report.
 *
 * Step order:
 *   0. Eligibility check
 *   1. Atomic CAS → 'purging'
 *   2. S3 cleanup (reads s3Keys from Document records while they still exist)
 *   3. Mongo hard-deletes (raw driver, per TENANT_MODELS — load-bearing erasure)
 *   4. Verification sweep (all Mongo counts must be zero)
 *   5. Sign + persist PurgeReport
 *   6. Hard-delete Tenant doc
 */
export async function purgeTenant(
  tenantId: Types.ObjectId,
  ctx: PurgeContext,
): Promise<PurgeOutcome> {
  await connectDb();

  // 0. Eligibility.
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new PurgeIneligible(`Tenant ${tenantId} not found`);
  }
  if (!isEligible(tenant)) {
    throw new PurgeIneligible(
      `Tenant ${tenant.slug} is not eligible for purge (status=${tenant.status}, purgeScheduledAt=${tenant.purgeScheduledAt?.toISOString() ?? 'null'})`,
    );
  }

  // 1. Atomic CAS to 'purging'.
  const cas = await Tenant.updateOne(
    {
      _id: tenant._id,
      status: { $in: ['pending_purge', 'purging'] },
    },
    { $set: { status: 'purging' } },
  );
  if (cas.matchedCount === 0) {
    throw new PurgeIneligible('Tenant state changed before purge could start');
  }

  // 2. S3 cleanup FIRST — we need the Document records intact to read s3Keys.
  // S3 errors are non-fatal: tracked in the return value for operator follow-up,
  // but don't block the Mongo deletes (those are the load-bearing erasure).
  const s3 = await s3CleanupForTenant(tenant._id);

  // 3. Mongo hard-deletes — raw driver, bypasses middleware (no soft-delete).
  const initialDeletes: Record<string, number> = {};
  for (const { model, label } of TENANT_MODELS) {
    const r = await model.collection.deleteMany({ tenantId });
    initialDeletes[label] = r.deletedCount ?? 0;
  }

  // 4. Verification sweep — every count must be zero.
  const verification: Record<string, number> = {};
  for (const { model, label } of TENANT_MODELS) {
    verification[label] = await model.collection.countDocuments({ tenantId });
  }
  const nonZero = Object.entries(verification).filter(([, n]) => n > 0);
  if (nonZero.length > 0) {
    throw new PurgeIncomplete(
      `Verification sweep found ${nonZero.length} non-zero counts after purge: ${nonZero.map(([k, v]) => `${k}=${v}`).join(', ')}`,
      verification,
    );
  }

  // 5. Sign and persist the report.
  const hmac = signPurgeReport({
    tenantId: String(tenant._id),
    tenantSlug: tenant.slug,
    initialDeletes,
    verification,
  });
  const report = await PurgeReport.create({
    tenantId: tenant._id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    purgedAt: new Date(),
    purgedByOperatorId: ctx.operatorId ?? null,
    purgedByOperatorEmail: ctx.operatorEmail ?? null,
    initialDeletes,
    verification,
    hmac,
    hmacAlgorithm: 'HMAC-SHA-256',
    triggeredBy: ctx.triggeredBy,
  });

  // 6. Hard-delete the tenant doc.
  await Tenant.deleteOne({ _id: tenant._id });

  return { reportId: report._id.toString(), initialDeletes, verification, s3 };
}

/**
 * Eligible if EITHER:
 *   - status is 'pending_purge' AND purgeScheduledAt is in the past, OR
 *   - status is 'purging' (crash recovery — purge was interrupted)
 */
function isEligible(tenant: TenantDoc): boolean {
  if (tenant.status === 'purging') return true;
  if (tenant.status !== 'pending_purge') return false;
  if (!tenant.purgeScheduledAt) return false;
  return new Date(tenant.purgeScheduledAt).getTime() <= Date.now();
}

export { isEligible };
