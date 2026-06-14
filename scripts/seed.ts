/**
 * MT-1 foundation seed. Per spec §8 MT-1, MT-1 wipes the DB and seeds one
 * default tenant. Multi-tenant signup arrives in MT-2.
 *
 *   npm run seed         # idempotent — inserts missing records, leaves existing alone
 *   npm run seed:reset   # drops the entire DB and reseeds from scratch
 *
 * What it creates:
 *   - 1 default Tenant: { slug: 'default', name: 'Default Firm', status: 'active' }
 *   - 3 default BUs scoped to that tenant (immigration, law, wealth)
 *   - 1 admin user (SEED_ADMIN_*) scoped to that tenant, access to all BUs
 *   - 1 standard user (lawyer@example.com) scoped to that tenant, law-only
 *   - 1 Settings doc for that tenant
 *
 * Same password for both users — for development only.
 */

import mongoose from 'mongoose';

import { hashPassword } from '../lib/auth/password';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { BusinessUnit } from '../lib/models/BusinessUnit';
import { getSettings } from '../lib/models/Settings';
import { Tenant } from '../lib/models/Tenant';
import { User } from '../lib/models/User';

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'System Admin';

const STD_EMAIL = 'lawyer@example.com';
const STD_NAME = 'Test Lawyer (Law only)';

const TENANT_SLUG = 'default';
const TENANT_NAME = 'Default Firm';

const RESET = process.argv.includes('--reset');

const DEFAULT_BUS = [
  { key: 'immigration', name: 'Immigration', description: 'Visa applications, status tracking, document workflows.', color: '#0ea5e9', order: 1 },
  { key: 'law',         name: 'Law',         description: 'Case management, hearings, billable time.',                color: '#8b5cf6', order: 2 },
  { key: 'wealth',      name: 'Wealth',      description: 'Portfolio reviews, advisory cases, compliance.',           color: '#10b981', order: 3 },
] as const;

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}

async function main(): Promise<void> {
  console.log('\nSeeding (MT-1 default tenant)\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  if (RESET) {
    log('reset', `dropping entire database "${mongoose.connection.name}"`);
    await mongoose.connection.dropDatabase();
  }

  // 1. Tenant — upsert.
  // Tenant has no tenantScopePlugin, so the filter doesn't need tenantId.
  const tenant = await Tenant.findOneAndUpdate(
    { slug: TENANT_SLUG },
    {
      $setOnInsert: {
        slug: TENANT_SLUG,
        name: TENANT_NAME,
        status: 'active',
        ownerEmail: ADMIN_EMAIL,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  if (!tenant) throw new Error('Tenant upsert returned no doc');
  log('tenant', `${tenant.slug} → ${tenant.name} (_id=${tenant._id})`);

  const tenantId = tenant._id;

  // 2. Business units — upsert each, scoped to tenant.
  // BusinessUnit has tenantScopePlugin — filter MUST include tenantId.
  for (const bu of DEFAULT_BUS) {
    const doc = await BusinessUnit.findOneAndUpdate(
      { tenantId, key: bu.key },
      { $setOnInsert: { ...bu, tenantId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    if (!doc) throw new Error(`BU upsert ${bu.key} returned no doc`);
    log('bu', `${doc.key} → ${doc.name}`);
  }

  // 3. Admin user.
  // User has tenantScopePlugin — filter MUST include tenantId.
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const admin = await User.findOneAndUpdate(
    { tenantId, email: ADMIN_EMAIL },
    {
      $setOnInsert: {
        tenantId,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        passwordHash,
        isAdmin: true,
        businessUnits: DEFAULT_BUS.map((b) => b.key),
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  if (!admin) throw new Error('Admin upsert returned no doc');
  log('admin', `${admin.email} (isAdmin=${admin.isAdmin})`);

  // 4. Standard user (law-only).
  const std = await User.findOneAndUpdate(
    { tenantId, email: STD_EMAIL },
    {
      $setOnInsert: {
        tenantId,
        email: STD_EMAIL,
        name: STD_NAME,
        passwordHash,
        isAdmin: false,
        businessUnits: ['law'],
        isActive: true,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  if (!std) throw new Error('Std user upsert returned no doc');
  log('user', `${std.email} (BUs=${std.businessUnits.join(', ')})`);

  // 5. Settings.
  const settings = await getSettings(tenantId.toString());
  log('settings', `org="${settings.organizationName}"`);

  console.log('\nDone. Credentials:');
  console.log(`  admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  user:  ${STD_EMAIL} / ${ADMIN_PASSWORD}\n`);

  await disconnectDb();
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
