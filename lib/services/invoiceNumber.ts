import { Types, type ClientSession } from 'mongoose';

import { Counter } from '../models/Counter';

/**
 * Format: `<BU>-INV-<YEAR>-<SEQ>` e.g. `LAW-INV-2026-0001`.
 *
 * Same atomic-counter pattern as `generateCaseNumber`. Year resets sequence.
 * Pass a `session` to participate in a transaction (no use case yet but the
 * interface is consistent with case numbers in case "duplicate invoice" or
 * similar multi-step flows arrive).
 */
export async function generateInvoiceNumber(
  tenantId: string,
  businessUnit: string,
  session?: ClientSession,
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `invoice:${businessUnit}:${year}`;
  const tid = new Types.ObjectId(tenantId);

  const counter = await Counter.findOneAndUpdate(
    { tenantId: tid, key },
    { $inc: { value: 1 }, $setOnInsert: { tenantId: tid, key } },
    { upsert: true, returnDocument: 'after', session },
  );
  if (!counter) {
    throw new Error(`Failed to advance invoice-number counter for ${key}`);
  }
  const padded = String(counter.value).padStart(4, '0');
  return `${businessUnit.toUpperCase()}-INV-${year}-${padded}`;
}
