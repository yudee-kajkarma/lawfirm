/**
 * Phase 0b smoke test.
 *
 * Run with:
 *   npm run test:plugins
 *
 * What it does:
 *   1. Connects to MONGODB_URI.
 *   2. Defines a throw-away `FooTest` model that uses all three plugins.
 *   3. Inside runWithContext, creates → updates → soft-deletes a doc.
 *   4. Verifies the soft-delete filter hides the doc, but `withDeleted` reveals it.
 *   5. Reads back the 3 audit entries (create / update / delete) with field diffs.
 *   6. Cleans up: removes the test doc and audit entries.
 *
 * Exit code 0 on success, 1 on any assertion failure.
 */

import mongoose, { Schema, Types } from 'mongoose';

import { runWithContext } from '../lib/auth/requestContext';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { auditFieldsPlugin } from '../lib/db/auditFieldsPlugin';
import { auditLogPlugin } from '../lib/db/auditLogPlugin';
import { softDeletePlugin } from '../lib/db/softDeletePlugin';
import { AuditLog } from '../lib/models/AuditLog';

const FooSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    value: { type: Number, default: 0 },
    businessUnit: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

FooSchema.plugin(softDeletePlugin);
FooSchema.plugin(auditFieldsPlugin);
FooSchema.plugin(auditLogPlugin, { collectionName: 'foos_test' });

type FooDoc = mongoose.InferSchemaType<typeof FooSchema> & { _id: Types.ObjectId };
const FooTest: mongoose.Model<FooDoc> =
   
  (mongoose.models.FooTest as mongoose.Model<FooDoc>) ?? mongoose.model<FooDoc>('FooTest', FooSchema);

function log(stage: string, msg: string): void {
   
  console.log(`  [${stage}] ${msg}`);
}

function fail(stage: string, msg: string): never {
   
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
   
  console.log('\nPhase 0b plugin smoke test\n');

  await connectDb();
  log('connect', `connected to ${mongoose.connection.name}`);

  const fakeUser = {
    _id: new Types.ObjectId().toString(),
    email: 'tester@example.com',
    isAdmin: true,
    businessUnits: ['immigration', 'law', 'wealth'],
  };

  await runWithContext({ user: fakeUser, source: 'user', ip: '127.0.0.1' }, async () => {
    // 1. CREATE
    const doc = await FooTest.create({ name: 'Hello', value: 1, businessUnit: 'law' });
    log('create', `id=${doc._id.toString()}, createdBy=${String(doc.get('createdBy'))}`);
    if (!doc.get('createdBy')) fail('create', 'createdBy not populated from context');

    // 2. UPDATE
    doc.set('value', 42);
    doc.set('name', 'Hello updated');
    await doc.save();
    log('update', 'saved name+value');
    if (!doc.get('updatedBy')) fail('update', 'updatedBy not populated from context');

    // 3. SOFT DELETE
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (doc as any).softDelete();
    log('softDelete', `deletedAt=${String(doc.get('deletedAt'))}`);

    // 4. Verify soft-delete filter
    const visible = await FooTest.findById(doc._id);
    if (visible) fail('filter', 'soft-deleted doc still visible to default query');
    log('filter', 'default query hides soft-deleted doc ✓');

    const withDeleted = await FooTest.findById(doc._id).setOptions({ withDeleted: true });
    if (!withDeleted) fail('filter', '`withDeleted: true` did not return soft-deleted doc');
    log('filter', '`withDeleted: true` reveals soft-deleted doc ✓');

    // 5. Verify audit entries
    const entries = await AuditLog.find({ documentId: doc._id }).sort({ createdAt: 1 });
    log('audit', `found ${entries.length} entries (expected 3)`);
    if (entries.length !== 3) {
      fail('audit', `expected 3 audit entries, got ${entries.length}`);
    }

    const [createEntry, updateEntry, deleteEntry] = entries;
    if (!createEntry || !updateEntry || !deleteEntry) {
      fail('audit', 'missing one of create/update/delete entries');
    }

    if (createEntry.action !== 'create') fail('audit', `1st entry action=${createEntry.action}`);
    if (updateEntry.action !== 'update') fail('audit', `2nd entry action=${updateEntry.action}`);
    if (deleteEntry.action !== 'delete') fail('audit', `3rd entry action=${deleteEntry.action}`);

    const updatePaths = updateEntry.changes.map((c) => c.path).sort();
    log('audit', `update changes: ${updatePaths.join(', ')}`);
    if (!updatePaths.includes('name') || !updatePaths.includes('value')) {
      fail('audit', 'update entry missing expected field diffs');
    }

    // Pretty-print the diff
    for (const entry of entries) {
       
      console.log(
        `    · ${entry.action} by ${entry.actorEmail} — ${entry.changes.length} change(s)`,
      );
      for (const c of entry.changes.slice(0, 4)) {
         
        console.log(`        ${c.path}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`);
      }
    }

    // 6. Cleanup
    await FooTest.deleteOne({ _id: doc._id }).setOptions({ withDeleted: true });
    await AuditLog.deleteMany({ documentId: doc._id });
    log('cleanup', 'removed test doc + audit entries');
  });

  await disconnectDb();
   
  console.log('\n  ✓ Phase 0b smoke test passed\n');
}

main().catch((err) => {
   
  console.error('\n  ✗ smoke test crashed:', err);
  process.exit(1);
});
