import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { AUDIT_ACTIONS, AUDIT_SOURCES } from '../constants/enums';

// Deliberately no plugins on this collection:
// - softDelete: audit entries must not be soft-deletable
// - auditFields/auditLog: the entries ARE the audit trail; recursion would be silly

const AuditLogSchema = new Schema(
  {
    collectionName: { type: String, required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorEmail: { type: String, default: null },
    source: { type: String, enum: AUDIT_SOURCES, required: true, default: 'user' },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    businessUnit: { type: String, default: null, index: true },
    changes: [
      {
        _id: false,
        path: { type: String, required: true },
        before: { type: Schema.Types.Mixed, default: null },
        after: { type: Schema.Types.Mixed, default: null },
      },
    ],
  },
  { timestamps: true },
);

// Retention via TTL — defaults to 180 days, overridable through env.
const TTL_SECONDS = Number(process.env.AUDIT_LOG_TTL_SECONDS) || 60 * 60 * 24 * 180;
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

// Composite indexes for the common access patterns.
AuditLogSchema.index({ documentId: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ collectionName: 1, createdAt: -1 });
AuditLogSchema.index({ businessUnit: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof AuditLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AuditLog: Model<AuditLogDoc> =
  (mongoose.models.AuditLog as Model<AuditLogDoc>) ??
  mongoose.model<AuditLogDoc>('AuditLog', AuditLogSchema);

export function serializeAuditLog(doc: Record<string, unknown>): {
  _id: string;
  collectionName: string;
  documentId: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  source: string;
  ip: string | null;
  userAgent: string | null;
  businessUnit: string | null;
  changes: Array<{ path: string; before: unknown; after: unknown }>;
  createdAt: string;
} {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  return {
    _id: String(doc._id),
    collectionName: String(doc.collectionName ?? ''),
    documentId: String(doc.documentId ?? ''),
    action: String(doc.action ?? ''),
    actorId: doc.actorId == null ? null : String(doc.actorId),
    actorEmail: doc.actorEmail == null ? null : String(doc.actorEmail),
    source: String(doc.source ?? 'user'),
    ip: doc.ip == null ? null : String(doc.ip),
    userAgent: doc.userAgent == null ? null : String(doc.userAgent),
    businessUnit: doc.businessUnit == null ? null : String(doc.businessUnit),
    changes: Array.isArray(doc.changes)
      ? (doc.changes as Array<{ path: string; before: unknown; after: unknown }>).map((c) => ({
          path: String(c.path ?? ''),
          before: c.before,
          after: c.after,
        }))
      : [],
    createdAt: isoDate(doc.createdAt),
  };
}
