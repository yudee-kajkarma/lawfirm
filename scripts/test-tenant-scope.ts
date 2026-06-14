/**
 * MT-0 smoke test for tenantScopePlugin + tenantAggregate.
 *
 * Run with:  npm run test:tenant-scope
 *
 * Verifies:
 *   1. Query without `tenantId` throws.
 *   2. Query with `tenantId` works.
 *   3. `.setOptions({ __crossTenant: true })` lets a query run without `tenantId`.
 *   4. Schema is tagged with TENANT_SCOPE_PLUGIN_SYMBOL.
 *   5. tenantAggregate scopes to the user's tenant. (Added in Task 3.)
 *
 * Exit code 0 on success, 1 on assertion failure.
 */

import mongoose, { Schema, Types } from 'mongoose';

import { connectDb, disconnectDb } from '../lib/db/connect';
import { tenantScopePlugin } from '../lib/db/tenantScopePlugin';
import { TENANT_SCOPE_PLUGIN_SYMBOL } from '../lib/tenancy/tenantModels';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}

function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

const ScopeFooSchema = new Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true },
);
ScopeFooSchema.plugin(tenantScopePlugin);

type ScopeFooDoc = mongoose.InferSchemaType<typeof ScopeFooSchema> & {
  _id: Types.ObjectId;
};
const ScopeFoo: mongoose.Model<ScopeFooDoc> =
  (mongoose.models.ScopeFoo as mongoose.Model<ScopeFooDoc>) ??
  mongoose.model<ScopeFooDoc>('ScopeFoo', ScopeFooSchema);

async function main(): Promise<void> {
  console.log('\nMT-0 tenant scope plugin smoke test\n');

  await connectDb();
  log('connect', `connected to ${mongoose.connection.name}`);

  const tenantA = new Types.ObjectId();
  const tenantB = new Types.ObjectId();

  // Cleanup any prior run.
  await ScopeFoo.collection.deleteMany({});

  // Seed: one doc per tenant.
  await ScopeFoo.collection.insertMany([
    { tenantId: tenantA, name: 'a-doc' },
    { tenantId: tenantB, name: 'b-doc' },
  ]);
  log('seed', 'inserted one doc per tenant via raw driver');

  // 1. Query without tenantId throws.
  let threw = false;
  try {
    await ScopeFoo.find({});
  } catch (err) {
    threw = true;
    log('no-tenant', `correctly threw: ${(err as Error).message}`);
  }
  if (!threw) fail('no-tenant', 'expected query without tenantId to throw');

  // 2. Query with tenantId works and is scoped.
  const aResults = await ScopeFoo.find({ tenantId: tenantA });
  if (aResults.length !== 1 || aResults[0]?.name !== 'a-doc') {
    fail('with-tenant', `expected 1 result for tenantA, got ${aResults.length}`);
  }
  log('with-tenant', "query with tenantId returns only that tenant's docs ✓");

  // 3. __crossTenant opt-out lets queries run without tenantId.
  const allResults = await ScopeFoo.find({}).setOptions({ __crossTenant: true });
  if (allResults.length !== 2) {
    fail('cross-tenant', `expected 2 cross-tenant results, got ${allResults.length}`);
  }
  log('cross-tenant', '__crossTenant: true returns all docs ✓');

  // 4. Schema is tagged with the plugin symbol.
  const tagged = Boolean(
    (ScopeFooSchema as unknown as Record<symbol, unknown>)[TENANT_SCOPE_PLUGIN_SYMBOL],
  );
  if (!tagged) fail('symbol', 'schema is not tagged with TENANT_SCOPE_PLUGIN_SYMBOL');
  log('symbol', 'schema correctly tagged ✓');

  // 5. Raw aggregate WITHOUT tenant scope returns docs from both tenants (the leak).
  // The plugin does NOT hook aggregate — that's WHY we have tenantAggregate.
  const leak = await ScopeFoo.aggregate([{ $match: {} }]);
  if (leak.length !== 2) {
    fail('aggregate-leak', `expected raw aggregate to see 2 docs (the leak we're guarding), got ${leak.length}`);
  }
  log('aggregate-leak', 'raw aggregate sees both tenants (confirming why the helper is needed) ✓');

  // 6. tenantAggregate scopes to the user's tenant.
  const { tenantAggregate } = await import('../lib/tenancy/tenantAggregate');
  const fakeUserA = { tenantId: tenantA.toString() } as { tenantId: string };
  const aOnly = await tenantAggregate<{ name: string }>(ScopeFoo, fakeUserA, [
    { $project: { name: 1, _id: 0 } },
  ]);
  if (aOnly.length !== 1 || aOnly[0]?.name !== 'a-doc') {
    fail('aggregate-scoped', `expected tenantAggregate to return only tenantA's 1 doc, got ${aOnly.length}`);
  }
  log('aggregate-scoped', 'tenantAggregate returns only the user\'s tenant ✓');

  // 7. tenantAggregate refuses to run if user has no tenantId.
  let aggThrew = false;
  try {
    await tenantAggregate(ScopeFoo, { tenantId: '' } as { tenantId: string }, []);
  } catch (err) {
    aggThrew = true;
    log('aggregate-empty', `correctly threw: ${(err as Error).message}`);
  }
  if (!aggThrew) fail('aggregate-empty', 'expected tenantAggregate to refuse empty tenantId');

  // Cleanup.
  await ScopeFoo.collection.deleteMany({});
  log('cleanup', 'removed test docs');

  await disconnectDb();
  console.log('\n  ✓ MT-0 tenant scope plugin smoke test passed\n');
}

main().catch((err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  process.exit(1);
});
