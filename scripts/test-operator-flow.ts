/**
 * MT-3 smoke test — operator state machine.
 *
 * Run with: npm run test:operator-flow
 *
 * Exercises: suspend → reactivate → suspend → schedule-purge → cancel-purge.
 * Verifies OperatorAuditLog entries land for each action.
 *
 * Does NOT exercise HTTP routes or UI — that's the user's manual gate.
 */

import mongoose from 'mongoose';

import { hashPassword } from '../lib/auth/password';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { BusinessUnit } from '../lib/models/BusinessUnit';
import { OperatorAuditLog } from '../lib/models/OperatorAuditLog';
import { PlatformOperator } from '../lib/models/PlatformOperator';
import { Settings } from '../lib/models/Settings';
import { Tenant } from '../lib/models/Tenant';
import { User } from '../lib/models/User';
import { performTenantSignup } from '../lib/services/tenantSignup';
import { writeOperatorAudit } from '../lib/services/operatorAudit';

import type { HydratedOperator } from '../lib/auth/withOperatorAuth';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}
function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

let tenantId: mongoose.Types.ObjectId | null = null;
let operatorId: mongoose.Types.ObjectId | null = null;

async function cleanup(): Promise<void> {
  if (tenantId) {
    await User.deleteMany({ tenantId }).setOptions({ withDeleted: true });
    await BusinessUnit.deleteMany({ tenantId }).setOptions({ withDeleted: true });
    await Settings.deleteMany({ tenantId });
    await Tenant.deleteOne({ _id: tenantId });
  }
  if (operatorId) {
    await OperatorAuditLog.deleteMany({ operatorId });
    await PlatformOperator.deleteOne({ _id: operatorId });
  }
}

async function main(): Promise<void> {
  console.log('\nMT-3 operator-flow smoke test\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  // Setup: tenant + operator.
  const stamp = Date.now();
  const signup = await performTenantSignup({
    companyName: `MT3 Test Tenant ${stamp}`,
    ownerName: 'Owner',
    ownerEmail: `mt3-tenant-${stamp}@example.com`,
    password: 'TestPassword123!',
  });
  tenantId = signup.tenant._id;
  log('setup', `tenant ${signup.tenant.slug} created (_id=${tenantId})`);

  const op = await PlatformOperator.create({
    email: `mt3-op-${stamp}@example.com`,
    name: 'MT3 Test Operator',
    passwordHash: await hashPassword('TestPassword123!'),
    isActive: true,
  });
  operatorId = op._id;
  const operator: HydratedOperator = { _id: op._id.toString(), email: op.email, name: op.name };
  log('setup', `operator ${op.email} created`);

  // 1. Suspend.
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) fail('suspend', 'tenant disappeared');
  tenant.status = 'suspended';
  tenant.suspendedAt = new Date();
  await tenant.save();
  await writeOperatorAudit({
    operator,
    action: 'suspend_tenant',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
  });
  log('suspend', `status=${tenant.status}, suspendedAt=${tenant.suspendedAt?.toISOString()}`);

  // 2. Reactivate.
  tenant.status = 'active';
  tenant.suspendedAt = null;
  await tenant.save();
  await writeOperatorAudit({
    operator,
    action: 'reactivate_tenant',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
  });
  log('reactivate', `status=${tenant.status}`);
  if (tenant.status !== 'active') fail('reactivate', 'status should be active');

  // 3. Suspend again, schedule-purge.
  tenant.status = 'suspended';
  tenant.suspendedAt = new Date();
  await tenant.save();
  tenant.status = 'pending_purge';
  const purgeAt = new Date(tenant.suspendedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  tenant.purgeScheduledAt = purgeAt;
  await tenant.save();
  await writeOperatorAudit({
    operator,
    action: 'schedule_purge',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
    details: { purgeScheduledAt: purgeAt.toISOString() },
  });
  log('schedule-purge', `status=${tenant.status}, purgeAt=${purgeAt.toISOString()}`);

  // 4. Cancel-purge.
  tenant.status = 'suspended';
  tenant.purgeScheduledAt = null;
  await tenant.save();
  await writeOperatorAudit({
    operator,
    action: 'cancel_purge',
    targetTenant: { _id: tenant._id, slug: tenant.slug },
  });
  log('cancel-purge', `status=${tenant.status}`);

  // 5. Verify audit entries.
  const entries = await OperatorAuditLog.find({ operatorId: operator._id }).sort({ createdAt: 1 });
  log('audit', `${entries.length} entries (expected 4: suspend, reactivate, schedule_purge, cancel_purge)`);
  if (entries.length !== 4) fail('audit', 'wrong number of audit entries');
  const expectedActions = ['suspend_tenant', 'reactivate_tenant', 'schedule_purge', 'cancel_purge'];
  for (let i = 0; i < 4; i++) {
    if (entries[i]?.action !== expectedActions[i]) {
      fail('audit', `entry ${i}: expected ${expectedActions[i]}, got ${entries[i]?.action}`);
    }
  }
  log('audit', `actions in order: ${entries.map((e) => e.action).join(' → ')} ✓`);

  await cleanup();
  log('cleanup', 'removed test data');

  await disconnectDb();
  console.log('\n  ✓ MT-3 operator-flow smoke test passed\n');
}

main().catch(async (err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  try { await cleanup(); } catch {/* ignore */}
  process.exit(1);
});
