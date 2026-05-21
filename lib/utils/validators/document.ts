import { z } from 'zod';

import { POLY_RELATED_TYPES } from '@/lib/constants/enums';
import { isValidObjectIdString } from '@/lib/utils/objectId';

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

const objectIdString = z.string().refine(isValidObjectIdString, { message: 'Invalid id' });

const relatedToSchema = z
  .object({
    type: z.enum(POLY_RELATED_TYPES),
    id: objectIdString,
  })
  .nullable();

// 100 MB upload cap. Files are streamed browser→S3 directly so our server
// never sees the bytes; the limit is just to keep S3 bills sane.
export const MAX_DOCUMENT_SIZE_BYTES = 100 * 1024 * 1024;

export const uploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(300),
  contentType: z.string().trim().min(1).max(200),
  size: z.number().int().min(0).max(MAX_DOCUMENT_SIZE_BYTES),
  businessUnit: z.string().min(1),
  relatedTo: relatedToSchema.optional(),
});

export const documentCreateSchema = z.object({
  filename: z.string().trim().min(1).max(300),
  contentType: z.string().trim().min(1).max(200),
  size: z.number().int().min(0).max(MAX_DOCUMENT_SIZE_BYTES),
  s3Key: z.string().trim().min(1).max(500),
  businessUnit: z.string().min(1),
  relatedTo: relatedToSchema.optional(),
  description: trimmedString(2000).nullish(),
  tags: z.array(z.string().trim().max(50)).default([]),
});

export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
