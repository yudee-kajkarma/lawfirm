import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';

/**
 * Singleton — exactly one Settings document exists per deployment. Access via
 * `getSettings()` which creates the doc on first call.
 *
 * Integration credentials are stored encrypted (AES-256-GCM via
 * `lib/utils/encryption.ts`, added in Phase 13). For now the fields exist as
 * placeholders so the schema is stable; the `integrations` subtree is excluded
 * from audit logs to keep secrets out of the diff record.
 */

const SettingsSchema = new Schema(
  {
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

// Intentionally no softDeletePlugin — the singleton can't be deleted.
SettingsSchema.plugin(auditFieldsPlugin);
SettingsSchema.plugin(auditLogPlugin, {
  collectionName: 'settings',
  // Whole subtree carries secrets; finer-grained logging arrives in Phase 13
  // alongside the settings UI.
  excludePaths: ['integrations'],
});

export type SettingsDoc = InferSchemaType<typeof SettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Settings: Model<SettingsDoc> =
  (mongoose.models.Settings as Model<SettingsDoc>) ??
  mongoose.model<SettingsDoc>('Settings', SettingsSchema);

export async function getSettings(): Promise<SettingsDoc> {
  const existing = await Settings.findOne({});
  if (existing) return existing;
  return Settings.create({});
}
