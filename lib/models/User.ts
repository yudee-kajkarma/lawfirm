import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';
import { tenantScopePlugin } from '../db/tenantScopePlugin';

const UserSchema = new Schema(
  {
    // `tenantId` is injected by tenantScopePlugin (required, indexed) — do not
    // declare it here. The plugin must run first so audit hooks see the field.
    email: {
      type: String,
      required: true,
      // NOT unique here — uniqueness is enforced per-tenant via the compound
      // index below. A global unique would prevent the same email existing in
      // different tenants.
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    // Bcrypt hash. `select: false` so it's never returned unless explicitly
    // requested with `.select('+passwordHash')` (used only by the auth flow).
    passwordHash: { type: String, required: true, select: false },
    isAdmin: { type: Boolean, default: false, index: true },
    // BU keys this user has access to. Empty array + isAdmin=false ⇒ no access.
    businessUnits: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date, default: null },
    avatarUrl: { type: String, default: null },
  },
  { timestamps: true },
);

// tenantScopePlugin FIRST — adds tenantId field before audit hooks reference it.
UserSchema.plugin(tenantScopePlugin);
UserSchema.plugin(softDeletePlugin);
UserSchema.plugin(auditFieldsPlugin);
UserSchema.plugin(auditLogPlugin, {
  collectionName: 'users',
  // passwordHash: must never appear in audit log.
  // lastLoginAt: changes on every login — would flood the log.
  excludePaths: ['passwordHash', 'lastLoginAt'],
});

// Per-tenant email uniqueness replaces the old global unique constraint.
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
// BU membership queries are always tenant-scoped in practice.
UserSchema.index({ tenantId: 1, businessUnits: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
  // tenantScopePlugin adds this field dynamically via schema.add(); InferSchemaType
  // doesn't see plugin-added fields, so we augment the type here.
  tenantId: mongoose.Types.ObjectId;
};

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>('User', UserSchema);

/**
 * Convert a Mongoose-leaned/hydrated User into the JSON-safe wire shape.
 * Never includes `passwordHash` (which is `select: false` anyway, but be
 * defensive in case a caller did `.select('+passwordHash')`).
 */
export function serializeUser(doc: Record<string, unknown>): {
  _id: string;
  tenantId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  businessUnits: string[];
  isActive: boolean;
  avatarUrl: string | null;
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
    tenantId: String(doc.tenantId),
    email: String(doc.email ?? ''),
    name: String(doc.name ?? ''),
    isAdmin: Boolean(doc.isAdmin),
    businessUnits: (doc.businessUnits as string[]) ?? [],
    isActive: doc.isActive !== false,
    avatarUrl: doc.avatarUrl == null ? null : String(doc.avatarUrl),
    lastLoginAt: isoDateOrNull(doc.lastLoginAt),
    createdAt: isoDate(doc.createdAt),
    updatedAt: isoDate(doc.updatedAt),
  };
}
