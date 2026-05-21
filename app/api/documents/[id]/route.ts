import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { DocumentModel, serializeDocument } from '@/lib/models/Document';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Document not found', 404);
  }
  const doc = await DocumentModel.findOne({ _id: params.id, ...scopedQuery(user) }).lean();
  if (!doc) return apiError('NOT_FOUND', 'Document not found', 404);
  return apiOk({ data: serializeDocument(doc as Record<string, unknown>) });
});

/**
 * Soft-delete only — the S3 object stays. A bucket lifecycle rule should
 * clean up keys whose metadata was deleted >30 days ago. Out of scope here.
 */
export const DELETE = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Document not found', 404);
  }
  const doc = await DocumentModel.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!doc) return apiError('NOT_FOUND', 'Document not found', 404);
  await doc.softDelete();
  return apiOk({ data: { _id: params.id } });
});
