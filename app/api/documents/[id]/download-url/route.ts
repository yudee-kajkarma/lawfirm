import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { getDownloadUrl } from '@/lib/integrations/storage';
import { DocumentModel } from '@/lib/models/Document';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Document not found', 404);
  }

  const doc = await DocumentModel.findOne({ _id: params.id, ...scopedQuery(user) }).lean();
  if (!doc) return apiError('NOT_FOUND', 'Document not found', 404);

  const forceDownload = req.nextUrl.searchParams.get('download') === 'true';
  const { url, expiresIn } = await getDownloadUrl({
    // `lean()` keeps these as primitives — type-safe enough.
    key: doc.s3Key as unknown as string,
    filename: doc.filename as unknown as string,
    forceDownload,
  });

  return apiOk({ data: { downloadUrl: url, expiresIn } });
});
