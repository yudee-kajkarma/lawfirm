/**
 * Foundation seed script.
 *
 *   npm run seed         # idempotent — inserts missing records, leaves existing alone
 *   npm run seed:reset   # drops users / BUs / settings / their audit entries, then seeds
 *
 * What it creates:
 *   - 3 default business units (immigration, law, wealth)
 *   - 1 admin user from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME
 *   - 1 standard user (lawyer@example.com, access to `law` only) — used to
 *     manually verify BU isolation in later phases
 *   - 1 Settings singleton with default values
 *
 * The standard user's password matches the admin's. Change it in Phase 13 UI.
 */

import mongoose from 'mongoose';

import { hashPassword } from '../lib/auth/password';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { AuditLog } from '../lib/models/AuditLog';
import { BusinessUnit } from '../lib/models/BusinessUnit';
import { Settings, getSettings } from '../lib/models/Settings';
import { User } from '../lib/models/User';

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'System Admin';

const STD_EMAIL = 'lawyer@example.com';
const STD_NAME = 'Test Lawyer (Law only)';

const RESET = process.argv.includes('--reset');

const DEFAULT_BUS = [
  {
    key: 'immigration',
    name: 'Immigration',
    description: 'Visa applications, status tracking, document workflows.',
    color: '#0ea5e9',
    order: 1,
  },
  {
    key: 'law',
    name: 'Law',
    description: 'Case management, hearings, billable time.',
    color: '#8b5cf6',
    order: 2,
  },
  {
    key: 'wealth',
    name: 'Wealth',
    description: 'Portfolio reviews, advisory cases, compliance.',
    color: '#10b981',
    order: 3,
  },
] as const;

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}

async function main(): Promise<void> {
  console.log('\nSeeding foundation collections\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  if (RESET) {
    log('reset', 'dropping users, businessUnits, settings + their audit entries');
    await User.deleteMany({}).setOptions({ withDeleted: true });
    await BusinessUnit.deleteMany({}).setOptions({ withDeleted: true });
    await Settings.deleteMany({});
    await AuditLog.deleteMany({
      collectionName: { $in: ['users', 'businessUnits', 'settings'] },
    });
  }

  // 1. Business units — upsert each.
  for (const bu of DEFAULT_BUS) {
    const doc = await BusinessUnit.findOneAndUpdate(
      { key: bu.key },
      { $setOnInsert: bu },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    log('bu', `${doc.key} → ${doc.name}`);
  }

  // 2. Admin user — `$setOnInsert` so re-running doesn't reset a rotated password.
  //    Use --reset to force a clean slate.
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const admin = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    {
      $setOnInsert: {
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
  log('admin', `${admin.email} (isAdmin=${admin.isAdmin})`);

  // 3. Standard user (Law only) — for manual BU-isolation testing later.
  const std = await User.findOneAndUpdate(
    { email: STD_EMAIL },
    {
      $setOnInsert: {
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
  log('user', `${std.email} (BUs=${std.businessUnits.join(', ')})`);

  // 4. Settings singleton.
  const settings = await getSettings();
  log('settings', `org="${settings.organizationName}"`);

  console.log('\nDone. Use these credentials in Phase 0d login:');
  console.log(`  admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  user:  ${STD_EMAIL} / ${ADMIN_PASSWORD}\n`);

  await disconnectDb();
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
