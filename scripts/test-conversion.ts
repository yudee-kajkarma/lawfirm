/**
 * Phase 3 conversion transaction smoke test.
 *
 *   npm run test:conversion
 *
 * Three scenarios:
 *   1. Happy path — convertLead creates a Contact, a Case, and stamps the
 *      Lead as converted. Audit log captures all three.
 *   2. Rollback — convertLead is called with an over-long caseTitle that
 *      fails the Case maxlength validator inside the transaction. We verify
 *      that the Lead was NOT marked converted and that no orphan Contact /
 *      Case landed in the DB.
 *   3. Concurrency — two converts fired in parallel get distinct
 *      caseNumbers via the atomic Counter.
 */

import mongoose, { Types } from 'mongoose';

import { runWithContext } from '../lib/auth/requestContext';
import { connectDb, disconnectDb } from '../lib/db/connect';
import { AuditLog } from '../lib/models/AuditLog';
import { Case } from '../lib/models/Case';
import { Contact } from '../lib/models/Contact';
import { Lead } from '../lib/models/Lead';
import { convertLead } from '../lib/services/leadConversion';

const BU = 'law';

function log(stage: string, msg: string): void {
  console.log(`  [${stage}] ${msg}`);
}

function fail(stage: string, msg: string): never {
  console.error(`\n  FAIL [${stage}] ${msg}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('\nPhase 3 conversion smoke test\n');
  await connectDb();
  log('connect', `db=${mongoose.connection.name}`);

  const testUser = {
    _id: new Types.ObjectId().toString(),
    email: 'test-conversion@example.com',
    name: 'Conversion Tester',
    isAdmin: true,
    businessUnits: ['immigration', 'law', 'wealth'],
  };

  await runWithContext(
    { user: testUser, source: 'user', ip: '127.0.0.1' },
    async () => {
      // ─────── Test 1: happy path ───────
      log('test1', 'happy path');
      const lead1 = await Lead.create({
        firstName: 'Conv',
        lastName: 'Test1',
        businessUnit: BU,
        source: 'website',
        stage: 'qualified',
        email: 'conv1@test.local',
      });

      const conversionStart = new Date();
      const r1 = await convertLead({
        user: testUser,
        leadId: String(lead1._id),
        caseTitle: 'Test case 1',
        caseType: 'civil',
      });

      if (!r1.case.caseNumber.startsWith('LAW-')) {
        fail('test1', `case number format wrong: ${r1.case.caseNumber}`);
      }
      log('test1', `created caseNumber=${r1.case.caseNumber}`);

      const refreshed1 = await Lead.findById(lead1._id);
      if (!refreshed1) fail('test1', 'lead missing after txn');
      if (refreshed1.stage !== 'converted') {
        fail('test1', `lead.stage=${refreshed1.stage}, expected converted`);
      }
      if (!refreshed1.convertedToCase?.equals(r1.case._id)) {
        fail('test1', 'lead not linked to case');
      }
      if (!refreshed1.linkedContact?.equals(r1.contact._id)) {
        fail('test1', 'lead not linked to contact');
      }
      if (!refreshed1.convertedAt) fail('test1', 'lead.convertedAt not stamped');
      log('test1', 'lead state correct ✓');

      // Only count audit entries written during the conversion itself.
      const conversionAudits = await AuditLog.find({
        createdAt: { $gte: conversionStart },
        documentId: { $in: [lead1._id, r1.contact._id, r1.case._id] },
      });
      log('test1', `audit entries from conversion: ${conversionAudits.length} (expected 3)`);
      if (conversionAudits.length !== 3) {
        fail('test1', `expected 3 audit entries, got ${conversionAudits.length}`);
      }
      const shape = conversionAudits
        .map((e) => `${e.collectionName}:${e.action}`)
        .sort()
        .join(', ');
      log('test1', `audit shape: ${shape}`);
      const expected = ['cases:create', 'contacts:create', 'leads:update'].sort().join(', ');
      if (shape !== expected) fail('test1', `audit shape mismatch — expected ${expected}`);

      // Cleanup test 1
      await Lead.deleteOne({ _id: lead1._id }).setOptions({ withDeleted: true });
      await Contact.deleteOne({ _id: r1.contact._id }).setOptions({ withDeleted: true });
      await Case.deleteOne({ _id: r1.case._id }).setOptions({ withDeleted: true });
      await AuditLog.deleteMany({
        documentId: { $in: [lead1._id, r1.contact._id, r1.case._id] },
      });

      // ─────── Test 2: rollback ───────
      log('test2', 'rollback on schema failure inside txn');
      const lead2 = await Lead.create({
        firstName: 'Conv',
        lastName: 'Test2',
        businessUnit: BU,
        source: 'website',
        stage: 'qualified',
      });

      let didThrow = false;
      try {
        await convertLead({
          user: testUser,
          // caseTitle > maxlength 200 → Case validation fails → txn aborts
          leadId: String(lead2._id),
          caseTitle: 'x'.repeat(300),
        });
      } catch (e) {
        didThrow = true;
        log('test2', `caught expected error: ${(e as Error).message.slice(0, 80)}`);
      }
      if (!didThrow) fail('test2', 'convertLead should have thrown on overlong title');

      const lead2After = await Lead.findById(lead2._id);
      if (lead2After?.stage !== 'qualified') {
        fail('test2', `lead.stage=${lead2After?.stage}, expected qualified`);
      }
      if (lead2After?.convertedToCase) {
        fail('test2', 'lead should not have convertedToCase after rollback');
      }
      log('test2', 'lead state unchanged ✓');

      const orphanContacts = await Contact.find({
        businessUnit: BU,
        firstName: 'Conv',
        lastName: 'Test2',
      });
      if (orphanContacts.length > 0) {
        fail('test2', `${orphanContacts.length} orphan contact(s) leaked`);
      }
      const orphanCases = await Case.find({ convertedFromLead: lead2._id });
      if (orphanCases.length > 0) {
        fail('test2', `${orphanCases.length} orphan case(s) leaked`);
      }
      log('test2', 'no orphan contact/case ✓');

      await Lead.deleteOne({ _id: lead2._id }).setOptions({ withDeleted: true });

      // ─────── Test 3: concurrent ───────
      log('test3', 'concurrent conversions');
      const leadA = await Lead.create({
        firstName: 'Conv',
        lastName: 'TestA',
        businessUnit: BU,
        source: 'website',
        stage: 'qualified',
      });
      const leadB = await Lead.create({
        firstName: 'Conv',
        lastName: 'TestB',
        businessUnit: BU,
        source: 'website',
        stage: 'qualified',
      });

      const [rA, rB] = await Promise.all([
        convertLead({ user: testUser, leadId: String(leadA._id), caseTitle: 'Concurrent A' }),
        convertLead({ user: testUser, leadId: String(leadB._id), caseTitle: 'Concurrent B' }),
      ]);

      log('test3', `caseNumbers: A=${rA.case.caseNumber}  B=${rB.case.caseNumber}`);
      if (rA.case.caseNumber === rB.case.caseNumber) {
        fail('test3', 'case number collision under concurrency!');
      }

      const allIds = [
        leadA._id,
        leadB._id,
        rA.contact._id,
        rB.contact._id,
        rA.case._id,
        rB.case._id,
      ];
      await Lead.deleteMany({ _id: { $in: [leadA._id, leadB._id] } }).setOptions({
        withDeleted: true,
      });
      await Contact.deleteMany({
        _id: { $in: [rA.contact._id, rB.contact._id] },
      }).setOptions({ withDeleted: true });
      await Case.deleteMany({ _id: { $in: [rA.case._id, rB.case._id] } }).setOptions({
        withDeleted: true,
      });
      await AuditLog.deleteMany({ documentId: { $in: allIds } });
    },
  );

  await disconnectDb();
  console.log('\n  ✓ Phase 3 conversion smoke test passed\n');
}

main().catch((err) => {
  console.error('\n  ✗ smoke test crashed:', err);
  process.exit(1);
});
