import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * Permanent record of a successful tenant purge. NEVER soft-deleted, never
 * tenant-scoped (the tenant it describes no longer exists). Operators can
 * audit the historical purge log even after the source tenant is gone.
 *
 * The `hmac` field is computed by `purgeReportSign.ts` over a canonical JSON
 * representation of `{ tenantId, tenantSlug, initialDeletes, verification }`.
 * Verification at read time proves the report wasn't tampered with after write.
 */
const PurgeReportSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    tenantSlug: { type: String, required: true, index: true },
    tenantName: { type: String, required: true },
    purgedAt: { type: Date, required: true, index: true },
    purgedByOperatorId: { type: Schema.Types.ObjectId, ref: 'PlatformOperator', default: null },
    purgedByOperatorEmail: { type: String, default: null },
    initialDeletes: { type: Schema.Types.Mixed, required: true },
    verification: { type: Schema.Types.Mixed, required: true },
    hmac: { type: String, required: true },
    hmacAlgorithm: { type: String, default: 'HMAC-SHA-256' },
    triggeredBy: { type: String, enum: ['cron', 'operator'], required: true },
  },
  { timestamps: true },
);

PurgeReportSchema.index({ purgedAt: -1 });

export type PurgeReportDoc = InferSchemaType<typeof PurgeReportSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PurgeReport: Model<PurgeReportDoc> =
  (mongoose.models.PurgeReport as Model<PurgeReportDoc>) ??
  mongoose.model<PurgeReportDoc>('PurgeReport', PurgeReportSchema);

export function serializePurgeReport(doc: Record<string, unknown>) {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    tenantSlug: String(doc.tenantSlug ?? ''),
    tenantName: String(doc.tenantName ?? ''),
    purgedAt: isoDate(doc.purgedAt),
    purgedByOperatorId: doc.purgedByOperatorId == null ? null : String(doc.purgedByOperatorId),
    purgedByOperatorEmail: doc.purgedByOperatorEmail == null ? null : String(doc.purgedByOperatorEmail),
    initialDeletes: doc.initialDeletes as Record<string, number>,
    verification: doc.verification as Record<string, number>,
    hmac: String(doc.hmac),
    hmacAlgorithm: String(doc.hmacAlgorithm ?? 'HMAC-SHA-256'),
    triggeredBy: doc.triggeredBy as 'cron' | 'operator',
    createdAt: isoDate(doc.createdAt),
  };
}
