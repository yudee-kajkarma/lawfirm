/**
 * MT-4 smoke test — full purge pipeline.
 *
 * Exercises:
 *   1. Signup → suspend → schedule-purge → fast-forward purgeScheduledAt → purge.
 *   2. Verification sweep — every TENANT_MODELS collection has 0 docs for the tenant.
 *   3. Signed report HMAC verifies.
 *   4. Tenant doc is hard-gone.
 *   5. Re-running purgeTenant on a gone tenant correctly throws PurgeIneligible.
 *
 * Does NOT exercise: HTTP routes, UI, the cron HMAC handshake (those are
 * the user's manual gate). Service layer only.
 */

import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../lib/db/connect';
import { PurgeReport } from '../lib/models/PurgeReport';
import { Tenant } from '../lib/models/Tenant';
import { performTenantSignup } from '../lib/services/tenantSignup';
import { purgeTenant } from '../lib/services/purgeTenant';
import { verifyPurgeReport } from '../lib/services/purgeReportSign';
import { TENANT_MODELS } from '../lib/tenancy/tenantModels';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}
function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('\nMT-4 purge pipeline smoke test\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  // 1. Signup.
  const stamp = Date.now();
  const { tenant } = await performTenantSignup({
    companyName: `MT4 Purge Test ${stamp}`,
    ownerName: 'Owner',
    ownerEmail: `mt4-purge-${stamp}@example.com`,
    password: 'TestPassword123!',
  });
  log('setup', `tenant ${tenant.slug} (_id=${tenant._id}) created with 3 BUs + admin user + Settings`);

  // Sanity-check: collections have records.
  const initialCounts: Record<string, number> = {};
  for (const { model, label } of TENANT_MODELS) {
    initialCounts[label] = await model.collection.countDocuments({ tenantId: tenant._id });
  }
  const nonEmpty = Object.entries(initialCounts).filter(([, n]) => n > 0);
  log('setup', `non-empty: ${nonEmpty.map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // 2. Suspend + schedule-purge with past purgeScheduledAt (simulate fast-forward).
  // Re-fetch as a hydrated Mongoose document so .save() is available.
  const tenantDoc = await Tenant.findById(tenant._id);
  if (!tenantDoc) fail('schedule', 'tenant disappeared after signup');
  tenantDoc.status = 'suspended';
  tenantDoc.suspendedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  await tenantDoc.save();
  tenantDoc.status = 'pending_purge';
  tenantDoc.purgeScheduledAt = new Date(Date.now() - 1000); // 1s ago — eligible
  await tenantDoc.save();
  log('schedule', `status=pending_purge, purgeScheduledAt=${tenantDoc.purgeScheduledAt.toISOString()}`);

  // 3. Run purge.
  const outcome = await purgeTenant(tenant._id, { triggeredBy: 'operator' });
  log('purge', `reportId=${outcome.reportId}`);
  log('purge', `initialDeletes summary: ${Object.entries(outcome.initialDeletes).filter(([, n]) => n > 0).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // 4. Verification: every count must be zero.
  for (const [label, count] of Object.entries(outcome.verification)) {
    if (count !== 0) fail('verify', `${label} still has ${count} docs after purge`);
  }
  log('verify', `all ${TENANT_MODELS.length} collections verified zero ✓`);

  // 5. Tenant doc is gone.
  const stillThere = await Tenant.findById(tenant._id);
  if (stillThere) fail('tenant-gone', 'tenant doc still exists after purge');
  log('tenant-gone', 'Tenant document hard-deleted ✓');

  // 6. PurgeReport exists and HMAC verifies.
  const report = await PurgeReport.findById(outcome.reportId).lean();
  if (!report) fail('report', 'PurgeReport not written');
  const valid = verifyPurgeReport(
    {
      tenantId: String(report.tenantId),
      tenantSlug: report.tenantSlug,
      initialDeletes: report.initialDeletes as Record<string, number>,
      verification: report.verification as Record<string, number>,
    },
    report.hmac,
  );
  if (!valid) fail('hmac', 'PurgeReport HMAC failed verification');
  log('hmac', 'PurgeReport HMAC verifies ✓');

  // 7. Re-purge after the fact returns PurgeIneligible (tenant is gone).
  try {
    await purgeTenant(tenant._id, { triggeredBy: 'cron' });
    fail('re-purge', 'purgeTenant should have thrown PurgeIneligible for gone tenant');
  } catch (err) {
    if ((err as Error).name === 'PurgeIneligible') {
      log('re-purge', `correctly threw PurgeIneligible: ${(err as Error).message}`);
    } else {
      fail('re-purge', `wrong error type: ${(err as Error).name}`);
    }
  }

  // Cleanup: drop the test PurgeReport so subsequent runs start clean.
  await PurgeReport.deleteOne({ _id: outcome.reportId });
  log('cleanup', 'removed test PurgeReport');

  await disconnectDb();
  console.log('\n  ✓ MT-4 purge pipeline smoke test passed\n');
}

main().catch(async (err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  process.exit(1);
});
