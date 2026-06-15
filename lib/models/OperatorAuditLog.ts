import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import {
  OPERATOR_AUDIT_ACTIONS,
  type OperatorAuditAction,
} from '@/lib/constants/enums';

// Re-export so any existing import path from this file still resolves.
export { OPERATOR_AUDIT_ACTIONS, type OperatorAuditAction };

/**
 * Separate from per-tenant `auditLogs` so platform-level activity doesn't
 * clutter what tenant admins see. No tenantScopePlugin — this collection
 * is cross-tenant by nature.
 */
const OperatorAuditLogSchema = new Schema(
  {
    operatorId: { type: Schema.Types.ObjectId, ref: 'PlatformOperator', required: true, index: true },
    operatorEmail: { type: String, required: true },
    action: { type: String, enum: OPERATOR_AUDIT_ACTIONS, required: true, index: true },
    targetTenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
    targetTenantSlug: { type: String, default: null },
    details: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);

OperatorAuditLogSchema.index({ operatorId: 1, createdAt: -1 });
OperatorAuditLogSchema.index({ targetTenantId: 1, createdAt: -1 });
OperatorAuditLogSchema.index({ action: 1, createdAt: -1 });

export type OperatorAuditLogDoc = InferSchemaType<typeof OperatorAuditLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OperatorAuditLog: Model<OperatorAuditLogDoc> =
  (mongoose.models.OperatorAuditLog as Model<OperatorAuditLogDoc>) ??
  mongoose.model<OperatorAuditLogDoc>('OperatorAuditLog', OperatorAuditLogSchema);

export function serializeOperatorAuditLog(doc: Record<string, unknown>): {
  _id: string;
  operatorId: string;
  operatorEmail: string;
  action: OperatorAuditAction;
  targetTenantId: string | null;
  targetTenantSlug: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
} {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  return {
    _id: String(doc._id),
    operatorId: String(doc.operatorId),
    operatorEmail: String(doc.operatorEmail ?? ''),
    action: (doc.action as OperatorAuditAction) ?? 'login',
    targetTenantId: doc.targetTenantId == null ? null : String(doc.targetTenantId),
    targetTenantSlug: doc.targetTenantSlug == null ? null : String(doc.targetTenantSlug),
    details: (doc.details as Record<string, unknown> | null) ?? null,
    ip: doc.ip == null ? null : String(doc.ip),
    userAgent: doc.userAgent == null ? null : String(doc.userAgent),
    createdAt: isoDate(doc.createdAt),
  };
}
