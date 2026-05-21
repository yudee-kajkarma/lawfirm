import { withAuth } from '@/lib/auth/withAuth';
import {
  STORAGE_BUCKET,
  generateStorageKey,
  getUploadUrl,
} from '@/lib/integrations/storage';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { uploadUrlSchema } from '@/lib/utils/validators/document';

export const runtime = 'nodejs';

/**
 * Generates a presigned PUT URL the browser can upload directly to S3 with —
 * keeps the file bytes out of our serverless runtime. The client is expected
 * to call `POST /api/documents` afterwards with the returned `s3Key` to
 * record metadata.
 */
export const POST = withAuth(async (req, _ctx, { user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = uploadUrlSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid upload data', 400, parsed.error.flatten());
  }

  if (!user.isAdmin && !user.businessUnits.includes(parsed.data.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }

  const s3Key = generateStorageKey(parsed.data.businessUnit);
  const { url, expiresIn } = await getUploadUrl({
    key: s3Key,
    contentType: parsed.data.contentType,
  });

  return apiOk({
    data: {
      uploadUrl: url,
      s3Key,
      bucket: STORAGE_BUCKET,
      expiresIn,
    },
  });
});
