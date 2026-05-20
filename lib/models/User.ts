import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
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

UserSchema.plugin(softDeletePlugin);
UserSchema.plugin(auditFieldsPlugin);
UserSchema.plugin(auditLogPlugin, {
  collectionName: 'users',
  // passwordHash: must never appear in audit log.
  // lastLoginAt: changes on every login — would flood the log.
  excludePaths: ['passwordHash', 'lastLoginAt'],
});

UserSchema.index({ businessUnits: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>('User', UserSchema);
