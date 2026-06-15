/**
 * Creates a PlatformOperator account from env vars.
 *
 *   npm run seed:operator
 *
 * Env:
 *   SEED_OPERATOR_EMAIL    (required)
 *   SEED_OPERATOR_PASSWORD (required)
 *   SEED_OPERATOR_NAME     (default: "Platform Operator")
 *
 * Rejects if the email is already a tenant User (spec §5.4 — one email,
 * one identity).
 */

import { hashPassword } from '../lib/auth/password';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { PlatformOperator } from '../lib/models/PlatformOperator';
import { User } from '../lib/models/User';

async function main(): Promise<void> {
  const email = (process.env.SEED_OPERATOR_EMAIL ?? '').toLowerCase().trim();
  const password = process.env.SEED_OPERATOR_PASSWORD ?? '';
  const name = process.env.SEED_OPERATOR_NAME ?? 'Platform Operator';

  if (!email || !password) {
    console.error('SEED_OPERATOR_EMAIL and SEED_OPERATOR_PASSWORD are required');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('SEED_OPERATOR_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  console.log('\nSeeding PlatformOperator\n');
  await connectDb();

  const tenantClash = await User.findOne({ email })
    .setOptions({ __crossTenant: true, withDeleted: true });
  if (tenantClash) {
    console.error(`Email ${email} is already a tenant user — operator seed rejected.`);
    await disconnectDb();
    process.exit(1);
  }

  const existing = await PlatformOperator.findOne({ email });
  if (existing) {
    console.log(`  [skip] operator ${email} already exists (${existing._id})`);
    await disconnectDb();
    return;
  }

  const passwordHash = await hashPassword(password);
  const op = await PlatformOperator.create({
    email,
    name,
    passwordHash,
    isActive: true,
  });
  console.log(`  [create] ${op.email} → _id=${op._id}`);

  await disconnectDb();
  console.log(`\nDone. Sign in at /login with: ${email} / <your password>`);
  console.log('You will be redirected to /admin/tenants on success.\n');
}

main().catch((err) => {
  console.error('\nSeed-operator failed:', err);
  process.exit(1);
});
