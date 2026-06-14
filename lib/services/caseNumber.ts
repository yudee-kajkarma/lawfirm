import { Types, type ClientSession } from 'mongoose';

import { Counter } from '../models/Counter';

/**
 * Atomically generates the next case number for a business unit in the
 * current calendar year. Format: `<BU>-<YEAR>-<SEQ>` e.g. `LAW-2026-0001`.
 *
 * MUST be called inside a transaction when used as part of a multi-collection
 * flow (e.g. lead → case conversion). The Counter increment is then part of
 * the transaction and will roll back if the transaction aborts. Outside a
 * transaction, the increment is still atomic on a single doc, so concurrent
 * standalone case creates still get distinct numbers — they just can't be
 * undone if a downstream step fails.
 */
export async function generateCaseNumber(
  tenantId: string,
  businessUnit: string,
  session?: ClientSession,
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `case:${businessUnit}:${year}`;
  const tid = new Types.ObjectId(tenantId);

  const counter = await Counter.findOneAndUpdate(
    { tenantId: tid, key },
    { $inc: { value: 1 }, $setOnInsert: { tenantId: tid, key } },
    { upsert: true, returnDocument: 'after', session },
  );
  if (!counter) {
    throw new Error(`Failed to advance case-number counter for ${key}`);
  }
  const padded = String(counter.value).padStart(4, '0');
  return `${businessUnit.toUpperCase()}-${year}-${padded}`;
}
