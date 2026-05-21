/**
 * Phase 9 Smart List translator smoke test.
 *
 *   npm run test:smart-list
 *
 * Three scenarios:
 *   1. Translator unit cases — build several filter trees, assert the
 *      produced Mongo filter shape is correct.
 *   2. Whitelist guard — a tree with an unlisted field must throw.
 *   3. End-to-end — seed Leads, translate a real-looking filter, run it
 *      through Lead.find, verify the right rows come back.
 */

import mongoose, { Types } from 'mongoose';

import { runWithContext } from '../lib/auth/requestContext';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { AuditLog } from '../lib/models/AuditLog';
import { Lead } from '../lib/models/Lead';
import { ValidationError } from '../lib/utils/errors';
import {
  translateFilterTree,
  type FilterTree,
} from '../lib/utils/smartListQuery';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}

function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

function assertEq(stage: string, actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`\n  FAIL [${stage}] ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('\nPhase 9 smart list smoke test\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  // ──────── Test 1: translator unit cases ────────
  log('test1', 'translator shapes');

  // Single condition collapses to flat shape (no $and wrapper).
  const t1: FilterTree = {
    conjunction: 'and',
    conditions: [{ field: 'stage', operator: 'equals', value: 'qualified' }],
  };
  assertEq('test1', translateFilterTree(t1, 'lead'), { stage: 'qualified' }, 'single equals');

  // Multi-condition AND
  const t2: FilterTree = {
    conjunction: 'and',
    conditions: [
      { field: 'stage', operator: 'in', value: ['qualified', 'proposal'] },
      { field: 'value', operator: 'gt', value: 10000 },
    ],
  };
  assertEq(
    'test1',
    translateFilterTree(t2, 'lead'),
    {
      $and: [
        { stage: { $in: ['qualified', 'proposal'] } },
        { value: { $gt: 10000 } },
      ],
    },
    'AND of two clauses',
  );

  // OR
  const t3: FilterTree = {
    conjunction: 'or',
    conditions: [
      { field: 'companyName', operator: 'contains', value: 'Acme' },
      { field: 'email', operator: 'startsWith', value: 'admin@' },
    ],
  };
  assertEq(
    'test1',
    translateFilterTree(t3, 'lead'),
    {
      $or: [
        { companyName: { $regex: 'Acme', $options: 'i' } },
        { email: { $regex: '^admin@', $options: 'i' } },
      ],
    },
    'OR with string operators',
  );

  // isEmpty / isNotEmpty
  const t4: FilterTree = {
    conjunction: 'and',
    conditions: [{ field: 'value', operator: 'isNotEmpty', value: null }],
  };
  assertEq(
    'test1',
    translateFilterTree(t4, 'lead'),
    { value: { $ne: null } },
    'isNotEmpty',
  );

  log('test1', 'all translator shapes correct ✓');

  // ──────── Test 2: whitelist guard ────────
  log('test2', 'whitelist guard');

  let threw = false;
  try {
    translateFilterTree(
      {
        conjunction: 'and',
        conditions: [{ field: 'passwordHash', operator: 'equals', value: 'xyz' }],
      },
      'lead',
    );
  } catch (err) {
    threw = err instanceof ValidationError;
  }
  if (!threw) fail('test2', 'unlisted field "passwordHash" should have thrown');
  log('test2', 'unlisted field rejected ✓');

  // Operator not allowed on that field
  threw = false;
  try {
    translateFilterTree(
      {
        conjunction: 'and',
        // `contains` is a string op; `stage` is an enum field — should reject.
        conditions: [{ field: 'stage', operator: 'contains', value: 'qual' }],
      },
      'lead',
    );
  } catch (err) {
    threw = err instanceof ValidationError;
  }
  if (!threw) fail('test2', 'disallowed operator should have thrown');
  log('test2', 'disallowed operator rejected ✓');

  // ──────── Test 3: round-trip against real Lead docs ────────
  log('test3', 'round-trip against Lead.find');

  const testUserId = new Types.ObjectId().toString();
  const testUser = {
    _id: testUserId,
    email: 'sl-test@example.com',
    name: 'Smart List Tester',
    isAdmin: true,
    businessUnits: ['immigration', 'law', 'wealth'],
  };

  await runWithContext({ user: testUser, source: 'user' }, async () => {
    // Seed three leads with distinguishable shapes.
    const a = await Lead.create({
      firstName: 'SLTestA',
      lastName: 'Hot',
      businessUnit: 'law',
      source: 'website',
      stage: 'qualified',
      value: 50000,
      email: 'sltest-a@example.com',
    });
    const b = await Lead.create({
      firstName: 'SLTestB',
      lastName: 'Cold',
      businessUnit: 'law',
      source: 'cold_outreach',
      stage: 'new_inquiry',
      value: 2000,
      email: 'sltest-b@example.com',
    });
    const c = await Lead.create({
      firstName: 'SLTestC',
      lastName: 'Lost',
      businessUnit: 'law',
      source: 'event',
      stage: 'lost',
      value: 30000,
      email: 'sltest-c@example.com',
    });

    // "Hot deals" smart list: stage in (qualified, proposal, negotiation) AND value > 10k.
    const filter = translateFilterTree(
      {
        conjunction: 'and',
        conditions: [
          {
            field: 'stage',
            operator: 'in',
            value: ['qualified', 'proposal', 'negotiation'],
          },
          { field: 'value', operator: 'gt', value: 10000 },
        ],
      },
      'lead',
    );

    // Limit the test to our seed rows so unrelated leads don't pollute.
    const found = await Lead.find({
      ...filter,
      _id: { $in: [a._id, b._id, c._id] },
    });

    const foundIds = found.map((d) => String(d._id));
    if (foundIds.length !== 1 || foundIds[0] !== String(a._id)) {
      fail('test3', `expected only A, got ${foundIds.join(', ')}`);
    }
    log('test3', 'filter returned only the hot-deal lead ✓');

    // Cleanup — both the seeded docs AND the audit entries they generated.
    // Forgetting the second line is what leaks "sl-test@example.com" rows
    // into the auditLogs collection over time.
    const seededIds = [a._id, b._id, c._id];
    await Lead.deleteMany({ _id: { $in: seededIds } }).setOptions({
      withDeleted: true,
    });
    await AuditLog.deleteMany({ documentId: { $in: seededIds } });
  });

  await disconnectDb();
  console.log('\n  ✓ Phase 9 smart list smoke test passed\n');
}

main().catch((err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  process.exit(1);
});
