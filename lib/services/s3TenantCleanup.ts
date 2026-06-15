import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import type { Types } from 'mongoose';

import { connectDb } from '@/lib/db/connect';
import { DocumentModel } from '@/lib/models/Document';
import { STORAGE_BUCKET, STORAGE_REGION } from '@/lib/integrations/storage';

/**
 * Delete every S3 object owned by a tenant.
 *
 * Implementation: query Documents for the tenant, collect s3Keys, batch-delete
 * via DeleteObjects (max 1000 keys per call). We iterate the Document
 * collection rather than scanning an S3 prefix because the current storage
 * key scheme (`documents/<bu>/<uuid>`) doesn't include tenantId — a future
 * prefix migration is its own project.
 *
 * Returns the number of objects successfully deleted. A partial S3 failure
 * (some keys errored) does NOT throw — the purge orchestrator's verification
 * sweep checks Document collection counts to confirm Mongo state, and the
 * S3 error list is logged for follow-up.
 */

declare global {

  var __s3CleanupClient__: S3Client | undefined;
}
const s3: S3Client =
  globalThis.__s3CleanupClient__ ??
  (globalThis.__s3CleanupClient__ = new S3Client({ region: STORAGE_REGION }));

const BATCH = 1000;

export type S3CleanupResult = {
  deleted: number;
  errors: Array<{ key: string; code?: string; message?: string }>;
};

export async function s3CleanupForTenant(
  tenantId: Types.ObjectId,
): Promise<S3CleanupResult> {
  await connectDb();

  const docs = await DocumentModel.find({ tenantId })
    .setOptions({ __crossTenant: true, withDeleted: true })
    .select('s3Key')
    .lean();

  const keys = docs.map((d) => String(d.s3Key)).filter(Boolean);
  if (keys.length === 0) return { deleted: 0, errors: [] };

  const errors: S3CleanupResult['errors'] = [];
  let deleted = 0;

  for (let i = 0; i < keys.length; i += BATCH) {
    const batch = keys.slice(i, i + BATCH);
    try {
      const res = await s3.send(
        new DeleteObjectsCommand({
          Bucket: STORAGE_BUCKET,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false },
        }),
      );
      deleted += res.Deleted?.length ?? 0;
      for (const e of res.Errors ?? []) {
        errors.push({
          key: String(e.Key ?? ''),
          code: e.Code ?? undefined,
          message: e.Message ?? undefined,
        });
      }
    } catch (err) {
      for (const Key of batch) {
        errors.push({ key: Key, message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return { deleted, errors };
}
