/**
 * MT-2 smoke test — signup happy path + email duplicate + isolation.
 *
 * Run with: npm run test:tenant-signup
 *
 * Verifies:
 *   1. Signup creates Tenant + 3 BUs + Admin User + Settings (all stamped with tenantId).
 *   2. A second signup with the SAME email is rejected (cross-tenant uniqueness).
 *   3. A second signup with a different email + same companyName produces a
 *      unique slug (-2 suffix).
 *   4. The two tenants are fully isolated — no data crosses.
 *   5. Slugify edge cases (whitespace, diacritics, special chars).
 *
 * Cleanup at end so the test is rerunnable.
 */

import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../lib/db/connect';
import { BusinessUnit } from '../lib/models/BusinessUnit';
import { Settings } from '../lib/models/Settings';
import { Tenant } from '../lib/models/Tenant';
import { User } from '../lib/models/User';
import { performTenantSignup } from '../lib/services/tenantSignup';
import { slugify } from '../lib/services/tenantSlug';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}
function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

const created: mongoose.Types.ObjectId[] = [];

async function purgeTenant(tenantId: mongoose.Types.ObjectId): Promise<void> {
  await User.deleteMany({ tenantId }).setOptions({ withDeleted: true });
  await BusinessUnit.deleteMany({ tenantId }).setOptions({ withDeleted: true });
  await Settings.deleteMany({ tenantId });
  await Tenant.deleteOne({ _id: tenantId });
}

async function main(): Promise<void> {
  console.log('\nMT-2 tenant signup smoke test\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  // 1. Happy path.
  const stamp = Date.now();
  const a = await performTenantSignup({
    companyName: 'Acme Legal',
    ownerName: 'Alice Admin',
    ownerEmail: `mt2-test-${stamp}-a@example.com`,
    password: 'TestPassword123!',
  });
  created.push(a.tenant._id);

  if (a.tenant.slug !== 'acme-legal') fail('happy', `expected slug=acme-legal, got ${a.tenant.slug}`);
  if (a.tenant.status !== 'active') fail('happy', `expected status=active, got ${a.tenant.status}`);
  log('happy', `tenant ${a.tenant.slug} (_id=${a.tenant._id}) created with admin ${a.user.email}`);

  const busA = await BusinessUnit.find({ tenantId: a.tenant._id });
  if (busA.length !== 3) fail('happy', `expected 3 BUs, got ${busA.length}`);
  log('happy', `BUs: ${busA.map((b) => b.key).sort().join(', ')}`);

  const settingsA = await Settings.findOne({ tenantId: a.tenant._id });
  if (!settingsA) fail('happy', 'no Settings doc created');
  log('happy', `settings org="${settingsA.organizationName}"`);

  // 2. Duplicate email rejected.
  let dupThrew = false;
  try {
    await performTenantSignup({
      companyName: 'Different Co',
      ownerName: 'Bob',
      ownerEmail: a.user.email,
      password: 'TestPassword123!',
    });
  } catch (err) {
    dupThrew = true;
    log('dup-email', `correctly rejected: ${(err as Error).message}`);
  }
  if (!dupThrew) fail('dup-email', 'expected duplicate email to throw');

  // 3. Same companyName → suffix slug.
  const b = await performTenantSignup({
    companyName: 'Acme Legal',
    ownerName: 'Beth',
    ownerEmail: `mt2-test-${stamp}-b@example.com`,
    password: 'TestPassword123!',
  });
  created.push(b.tenant._id);
  if (b.tenant.slug !== 'acme-legal-2') {
    fail('slug-collision', `expected slug=acme-legal-2, got ${b.tenant.slug}`);
  }
  log('slug-collision', `second Acme Legal got slug=${b.tenant.slug} ✓`);

  // 4. Cross-tenant isolation.
  const aHasOwnBu = await BusinessUnit.findOne({
    tenantId: a.tenant._id,
    _id: busA[0]?._id,
  });
  if (!aHasOwnBu) fail('isolation', 'A cannot see its own BU — sanity check failed');

  const aCannotSeeBsUser = await User.findOne({
    tenantId: a.tenant._id,
    email: b.user.email,
  });
  if (aCannotSeeBsUser) fail('isolation', "A leaked B's user");
  log('isolation', 'cross-tenant queries correctly isolate ✓');

  // 5. Slugify edge cases.
  const cases: [string, string][] = [
    ['Smith & Co.', 'smith-co'],
    ['  multiple   spaces  ', 'multiple-spaces'],
    ['Café Solera', 'cafe-solera'],
    ['!!!nothing-real!!!', 'nothing-real'],
  ];
  for (const [input, expected] of cases) {
    const got = slugify(input);
    if (got !== expected) fail('slug-edge', `slugify("${input}") = "${got}", expected "${expected}"`);
    log('slug-edge', `"${input}" → "${got}" ✓`);
  }
  // Empty string falls back to "firm" inside generateUniqueTenantSlug; slugify itself returns ''.
  if (slugify('') !== '') fail('slug-edge', `slugify("") = "${slugify('')}", expected ""`);
  log('slug-edge', `"" → "" (generateUniqueTenantSlug falls back to "firm") ✓`);

  // Cleanup.
  for (const tid of created) {
    await purgeTenant(tid);
  }
  log('cleanup', `purged ${created.length} test tenants`);

  await disconnectDb();
  console.log('\n  ✓ MT-2 tenant signup smoke test passed\n');
}

main().catch(async (err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  try {
    for (const tid of created) await purgeTenant(tid);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
