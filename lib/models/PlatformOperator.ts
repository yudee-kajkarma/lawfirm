import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * Platform operators — you and your support team. Sit ABOVE the tenant
 * hierarchy: no tenantId, no tenantScopePlugin. Seeded via a script
 * (`scripts/seed-operator.ts`); no self-serve creation UI.
 */
const PlatformOperatorSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Deliberately NO plugins:
//   - tenantScopePlugin — operators sit above the tenant boundary.
//   - softDeletePlugin — small collection, hard-delete is fine.
//   - auditLogPlugin — operator activity goes into OperatorAuditLog manually.

export type PlatformOperatorDoc = InferSchemaType<typeof PlatformOperatorSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PlatformOperator: Model<PlatformOperatorDoc> =
  (mongoose.models.PlatformOperator as Model<PlatformOperatorDoc>) ??
  mongoose.model<PlatformOperatorDoc>('PlatformOperator', PlatformOperatorSchema);

export function serializePlatformOperator(doc: Record<string, unknown>): {
  _id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
} {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  const isoDateOrNull = (v: unknown): string | null =>
    v == null ? null : isoDate(v);
  return {
    _id: String(doc._id),
    email: String(doc.email ?? ''),
    name: String(doc.name ?? ''),
    isActive: doc.isActive !== false,
    lastLoginAt: isoDateOrNull(doc.lastLoginAt),
    createdAt: isoDate(doc.createdAt),
    updatedAt: isoDate(doc.updatedAt),
  };
}
