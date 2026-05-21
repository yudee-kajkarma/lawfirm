import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { POLY_RELATED_TYPES } from '../constants/enums';
import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';

const RelatedToSchema = new Schema(
  {
    type: { type: String, enum: POLY_RELATED_TYPES, required: true },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const DocumentSchema = new Schema(
  {
    /** As uploaded by the user — preserved for display + download filename. */
    filename: { type: String, required: true, trim: true, maxlength: 300 },
    /** MIME type as reported by the browser at upload time. */
    contentType: { type: String, required: true, maxlength: 200 },
    /** Bytes. Client-reported; trust but verify via S3 head if needed. */
    size: { type: Number, required: true, min: 0 },

    /** S3 object key. Format: `documents/<bu>/<uuid>`. Unique. */
    s3Key: { type: String, required: true, unique: true },
    /** Denormalized bucket name so we don't depend on env at read time. */
    s3Bucket: { type: String, required: true },

    businessUnit: { type: String, required: true, index: true },
    relatedTo: { type: RelatedToSchema, default: null },

    description: { type: String, default: null, maxlength: 2000 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

DocumentSchema.plugin(softDeletePlugin);
DocumentSchema.plugin(auditFieldsPlugin);
DocumentSchema.plugin(auditLogPlugin, { collectionName: 'documents' });

DocumentSchema.index({ 'relatedTo.type': 1, 'relatedTo.id': 1 });
DocumentSchema.index({ businessUnit: 1, createdAt: -1 });
DocumentSchema.index({ filename: 'text', description: 'text' });

export type DocumentDoc = InferSchemaType<typeof DocumentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const DocumentModel: Model<DocumentDoc> =
  (mongoose.models.Document as Model<DocumentDoc>) ??
  mongoose.model<DocumentDoc>('Document', DocumentSchema);

export function serializeDocument(doc: Record<string, unknown>) {
  const stringify = (v: unknown): string | null => (v == null ? null : String(v));
  const isoDateRequired = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);

  const relatedTo = doc.relatedTo as { type: string; id: unknown } | null | undefined;

  return {
    _id: String(doc._id),
    filename: doc.filename as string,
    contentType: doc.contentType as string,
    size: doc.size as number,
    businessUnit: doc.businessUnit as string,
    relatedTo: relatedTo ? { type: relatedTo.type, id: String(relatedTo.id) } : null,
    description: stringify(doc.description),
    tags: (doc.tags as string[]) ?? [],
    createdBy: stringify(doc.createdBy),
    updatedBy: stringify(doc.updatedBy),
    createdAt: isoDateRequired(doc.createdAt),
    updatedAt: isoDateRequired(doc.updatedAt),
    // s3Key / s3Bucket intentionally NOT exposed — clients get presigned
    // URLs from the dedicated download endpoint instead.
  };
}
