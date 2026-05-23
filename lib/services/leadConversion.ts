import mongoose, { Types, type HydratedDocument } from 'mongoose';

import { scopedQuery } from '../auth/scopedQuery';
import type { HydratedUser } from '../auth/withAuth';
import { Case, type CaseDoc } from '../models/Case';
import { Contact, type ContactDoc } from '../models/Contact';
import { Lead, type LeadDoc } from '../models/Lead';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';

import { generateCaseNumber } from './caseNumber';

export type ConvertLeadArgs = {
  user: HydratedUser;
  leadId: string;
  caseTitle: string;
  caseType?: string | null;
  caseDescription?: string | null;
  caseValue?: number | null;
  caseTags?: string[];
  assignedTo?: string | null;
  existingContactId?: string | null;
};

// Use `HydratedDocument` so callers get `.toObject()` / `.save()` typed.
export type ConvertLeadResult = {
  lead: HydratedDocument<LeadDoc>;
  contact: HydratedDocument<ContactDoc>;
  case: HydratedDocument<CaseDoc>;
};

/**
 * The canonical multi-collection flow (CLAUDE.md §9).
 *
 * Wraps three writes in a single Mongoose transaction:
 *   1. Create or attach a Contact
 *   2. Allocate a Case number + create the Case
 *   3. Mark the Lead as converted with back-references
 *
 * If any step fails the transaction aborts and nothing is written — verified
 * by `scripts/test-conversion.ts`. Audit-log entries are still written for
 * each successful save because the save hooks fire inside the transaction;
 * on rollback those entries roll back too (audit log is in the same DB).
 */
export async function convertLead(args: ConvertLeadArgs): Promise<ConvertLeadResult> {
  const { user } = args;

  const session = await mongoose.startSession();
  try {
    let result: ConvertLeadResult | undefined;

    await session.withTransaction(async () => {
      const lead = await Lead.findOne({
        _id: args.leadId,
        ...scopedQuery(user),
      }).session(session);
      if (!lead) throw new NotFoundError('Lead not found');
      if (lead.stage === 'converted') {
        throw new ConflictError('Lead is already converted');
      }

      // 1. Contact — either link to an existing one or spin up from the lead.
      let contact: HydratedDocument<ContactDoc>;
      if (args.existingContactId) {
        const existing = await Contact.findOne({
          _id: args.existingContactId,
          ...scopedQuery(user),
        }).session(session);
        if (!existing) throw new NotFoundError('Existing contact not found');
        if (existing.businessUnit !== lead.businessUnit) {
          throw new ForbiddenError('Existing contact is in a different business unit');
        }
        contact = existing;
      } else {
        const created = await Contact.create(
          [
            {
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email,
              phone: lead.phone,
              companyName: lead.companyName,
              jobTitle: lead.jobTitle,
              contactType: 'client',
              businessUnit: lead.businessUnit,
            },
          ],
          { session },
        );
        contact = created[0]!;
      }

      // 2. Case — number is atomic-incremented inside the txn so rollbacks
      //    roll the counter back too.
      const caseNumber = await generateCaseNumber(lead.businessUnit, session);
      const assignedTo =
        args.assignedTo && Types.ObjectId.isValid(args.assignedTo)
          ? new Types.ObjectId(args.assignedTo)
          : lead.assignedTo;
      const createdCase = await Case.create(
        [
          {
            caseNumber,
            title: args.caseTitle,
            caseType: args.caseType ?? null,
            description: args.caseDescription ?? null,
            value: args.caseValue ?? null,
            tags: args.caseTags ?? [],
            businessUnit: lead.businessUnit,
            clientId: contact._id,
            assignedTo,
            convertedFromLead: lead._id,
            openedAt: new Date(),
          },
        ],
        { session },
      );
      const newCase = createdCase[0]!;

      // 3. Lead — mark converted with cross-references. Fetch-then-save so
      //    the audit + audit-fields hooks fire.
      lead.stage = 'converted';
      lead.convertedToCase = newCase._id;
      lead.convertedAt = new Date();
      lead.linkedContact = contact._id;
      await lead.save({ session });

      result = { lead, contact, case: newCase };
    });

    if (!result) {
      throw new Error('Transaction completed without producing a result');
    }
    return result;
  } finally {
    await session.endSession();
  }
}
