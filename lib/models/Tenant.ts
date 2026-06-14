import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';

/**
 * The top of the tenant hierarchy.
 *
 * Deliberate omissions:
 *   - No `softDeletePlugin`. A tenant is either present (active / suspended /
 *     pending_purge / purging) or hard-deleted by the purge pipeline. There is
 *     no "deleted-but-recoverable" state for a tenant.
 *   - No `tenantScopePlugin`. The Tenant model sits ABOVE the tenant boundary.
 *
 * `auditLogPlugin` IS applied — every state transition (suspend, reactivate,
 * schedule-purge, cancel-purge) writes to the regular audit log so tenant
 * admins can see actions on their own tenant.
 */

export const TENANT_STATUSES = [
  'active',
  'suspended',
  'pending_purge',
  'purging',
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

const TenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: TENANT_STATUSES,
      default: 'active',
      index: true,
    },
    suspendedAt: { type: Date, default: null },
    purgeScheduledAt: { type: Date, default: null, index: true },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

TenantSchema.plugin(auditFieldsPlugin);
TenantSchema.plugin(auditLogPlugin, { collectionName: 'tenants' });

export type TenantDoc = InferSchemaType<typeof TenantSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Tenant: Model<TenantDoc> =
  (mongoose.models.Tenant as Model<TenantDoc>) ??
  mongoose.model<TenantDoc>('Tenant', TenantSchema);

export function serializeTenant(doc: Record<string, unknown>): {
  _id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  suspendedAt: string | null;
  purgeScheduledAt: string | null;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
} {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  const isoDateOrNull = (v: unknown): string | null =>
    v == null ? null : isoDate(v);
  return {
    _id: String(doc._id),
    name: String(doc.name ?? ''),
    slug: String(doc.slug ?? ''),
    status: (doc.status as TenantStatus) ?? 'active',
    suspendedAt: isoDateOrNull(doc.suspendedAt),
    purgeScheduledAt: isoDateOrNull(doc.purgeScheduledAt),
    ownerEmail: String(doc.ownerEmail ?? ''),
    createdAt: isoDate(doc.createdAt),
    updatedAt: isoDate(doc.updatedAt),
  };
}
