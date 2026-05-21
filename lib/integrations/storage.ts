import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;

if (!REGION) throw new Error('AWS_REGION must be set in .env.local');
if (!BUCKET) throw new Error('AWS_S3_BUCKET must be set in .env.local');

/**
 * Single S3 client pinned on globalThis so HMR doesn't recreate it. The SDK
 * automatically picks up `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from
 * the environment via the default credential provider chain.
 */
declare global {
   
  var __s3Client__: S3Client | undefined;
}

const s3: S3Client = globalThis.__s3Client__ ?? (globalThis.__s3Client__ = new S3Client({ region: REGION }));

const UPLOAD_URL_TTL_SECONDS = 60 * 5; // 5 min
const DOWNLOAD_URL_TTL_SECONDS = 60 * 5; // 5 min

export const STORAGE_BUCKET = BUCKET;
export const STORAGE_REGION = REGION;

export function generateStorageKey(businessUnit: string): string {
  // Predictable prefix lets you scan / lifecycle by BU. UUID inside ensures
  // uniqueness without collisions even on rapid uploads from the same user.
  return `documents/${businessUnit}/${randomUUID()}`;
}

export async function getUploadUrl(args: {
  key: string;
  contentType: string;
}): Promise<{ url: string; expiresIn: number }> {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: args.key,
    ContentType: args.contentType,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  return { url, expiresIn: UPLOAD_URL_TTL_SECONDS };
}

export async function getDownloadUrl(args: {
  key: string;
  filename?: string;
  /** When true, force a download save dialog instead of inline preview. */
  forceDownload?: boolean;
}): Promise<{ url: string; expiresIn: number }> {
  const filename = args.filename ?? 'download';
  // Escape any quotes for safe inclusion in the header value.
  const safeName = filename.replace(/"/g, '\\"');
  const disposition = args.forceDownload
    ? `attachment; filename="${safeName}"`
    : `inline; filename="${safeName}"`;

  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: args.key,
    ResponseContentDisposition: disposition,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  return { url, expiresIn: DOWNLOAD_URL_TTL_SECONDS };
}

export async function deleteStorageObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
