import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { POLY_RELATED_TYPES } from '@/lib/constants/enums';
import { STORAGE_BUCKET } from '@/lib/integrations/storage';
import { DocumentModel, serializeDocument } from '@/lib/models/Document';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { isValidObjectIdString } from '@/lib/utils/objectId';
import { parseListQuery } from '@/lib/utils/parseListQuery';
import { documentCreateSchema } from '@/lib/utils/validators/document';

export const runtime = 'nodejs';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GET = withAuth(async (req, _ctx, { user }) => {
  await connectDb();
  const list = parseListQuery(req);
  const sp = req.nextUrl.searchParams;

  const filter: Record<string, unknown> = { ...scopedQuery(user, list.businessUnit) };

  const relType = sp.get('relatedToType');
  const relId = sp.get('relatedToId');
  if (relType && relId) {
    if (
      !(POLY_RELATED_TYPES as readonly string[]).includes(relType) ||
      !isValidObjectIdString(relId)
    ) {
      return apiError('VALIDATION_ERROR', 'Invalid relatedTo filter', 400);
    }
    filter['relatedTo.type'] = relType;
    filter['relatedTo.id'] = relId;
  }

  if (list.search) {
    const re = new RegExp(escapeRegex(list.search), 'i');
    filter.$or = [{ filename: re }, { description: re }];
  }

  const skip = (list.page - 1) * list.limit;
  const sort: Record<string, 1 | -1> = { [list.sort.field]: list.sort.direction };

  const [items, total] = await Promise.all([
    DocumentModel.find(filter).sort(sort).skip(skip).limit(list.limit).lean(),
    DocumentModel.countDocuments(filter),
  ]);

  return apiOk({
    data: items.map((doc) => serializeDocument(doc as Record<string, unknown>)),
    meta: { page: list.page, limit: list.limit, total },
  });
});

/**
 * Records metadata for a file the browser has already PUT to S3 using the
 * key returned from `POST /api/documents/upload-url`. We don't re-fetch the
 * object here — the client is trusted to have uploaded successfully before
 * calling this; if it didn't, downloads will fail and an admin can clean up.
 */
export const POST = withAuth(async (req, _ctx, { user }) => {
  await connectDb();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = documentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid document data', 400, parsed.error.flatten());
  }

  if (!user.isAdmin && !user.businessUnits.includes(parsed.data.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }

  // Anti-tampering — refuse to record a key that doesn't sit under the
  // requested BU's prefix. `generateStorageKey` always uses the same shape.
  const expectedPrefix = `documents/${parsed.data.businessUnit}/`;
  if (!parsed.data.s3Key.startsWith(expectedPrefix)) {
    return apiError('VALIDATION_ERROR', 'Mismatched s3Key for this business unit', 400);
  }

  const created = await DocumentModel.create({
    ...parsed.data,
    s3Bucket: STORAGE_BUCKET,
    tenantId: user.tenantId,
  });

  return apiOk(
    { data: serializeDocument(created.toObject() as Record<string, unknown>) },
    201,
  );
});
