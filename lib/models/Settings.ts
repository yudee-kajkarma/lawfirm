import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { tenantScopePlugin } from '../db/tenantScopePlugin';

/**
 * Singleton — exactly one Settings document exists per tenant. Access via
 * `getSettings(tenantId)` which creates the doc on first call.
 *
 * Integration credentials are stored encrypted (AES-256-GCM via
 * `lib/utils/encryption.ts`, added in Phase 13). For now the fields exist as
 * placeholders so the schema is stable; the `integrations` subtree is excluded
 * from audit logs to keep secrets out of the diff record.
 */

const SettingsSchema = new Schema(
  {
    // `tenantId` is injected by tenantScopePlugin — one Settings doc per tenant.
    organizationName: { type: String, default: 'InstaPath CRM' },
    integrations: {
      sendgrid: {
        enabled: { type: Boolean, default: false },
        fromEmail: { type: String, default: null },
        fromName: { type: String, default: null },
        apiKey: { type: String, default: null, select: false },
      },
      twilio: {
        enabled: { type: Boolean, default: false },
        fromNumber: { type: String, default: null },
        accountSid: { type: String, default: null, select: false },
        authToken: { type: String, default: null, select: false },
      },
      whatsapp: {
        enabled: { type: Boolean, default: false },
        phoneNumberId: { type: String, default: null },
        businessAccountId: { type: String, default: null },
        accessToken: { type: String, default: null, select: false },
        appSecret: { type: String, default: null, select: false },
      },
    },
    features: {
      aiAssistantEnabled: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

// tenantScopePlugin FIRST — adds tenantId field before audit hooks reference it.
// Intentionally no softDeletePlugin — the singleton can't be deleted.
SettingsSchema.plugin(tenantScopePlugin);
SettingsSchema.plugin(auditFieldsPlugin);
SettingsSchema.plugin(auditLogPlugin, {
  collectionName: 'settings',
  // Whole subtree carries secrets; finer-grained logging arrives in Phase 13
  // alongside the settings UI.
  excludePaths: ['integrations'],
});

// Exactly one Settings doc per tenant.
SettingsSchema.index({ tenantId: 1 }, { unique: true });

export type SettingsDoc = InferSchemaType<typeof SettingsSchema> & {
  _id: mongoose.Types.ObjectId;
  // tenantScopePlugin adds this field dynamically via schema.add(); InferSchemaType
  // doesn't see plugin-added fields, so we augment the type here.
  tenantId: mongoose.Types.ObjectId;
};

export const Settings: Model<SettingsDoc> =
  (mongoose.models.Settings as Model<SettingsDoc>) ??
  mongoose.model<SettingsDoc>('Settings', SettingsSchema);

/**
 * Returns the Settings doc for a tenant, creating it on first access.
 * The `tenantId` argument satisfies the tenantScopePlugin guard on create.
 */
export async function getSettings(tenantId: string): Promise<SettingsDoc> {
  const tid = new mongoose.Types.ObjectId(tenantId);
  const existing = await Settings.findOne({ tenantId: tid });
  if (existing) return existing;
  return Settings.create({ tenantId: tid });
}
