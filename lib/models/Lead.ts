import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { LEAD_SOURCES, LEAD_STAGES } from '../constants/enums';
import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';
import { tenantScopePlugin } from '../db/tenantScopePlugin';

const LeadSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, lowercase: true, trim: true, default: null, maxlength: 200 },
    phone: { type: String, trim: true, default: null, maxlength: 40 },

    source: { type: String, enum: LEAD_SOURCES, default: 'other', required: true, index: true },
    stage: { type: String, enum: LEAD_STAGES, default: 'new_inquiry', required: true, index: true },

    businessUnit: { type: String, required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    companyName: { type: String, default: null, trim: true, maxlength: 200 },
    jobTitle: { type: String, default: null, trim: true, maxlength: 200 },

    // Estimated deal value in the user's working currency. Currency itself
    // isn't tracked yet — handled per-BU in Phase 12 (invoices).
    value: { type: Number, default: null, min: 0 },
    expectedCloseDate: { type: Date, default: null },

    notes: { type: String, default: null, maxlength: 5000 },
    tags: { type: [String], default: [] },
    customFields: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },

    // Set by the lead → case conversion flow (Phase 3). Populated for
    // converted leads so we can link "this lead became case X".
    convertedToCase: { type: Schema.Types.ObjectId, ref: 'Case', default: null },
    convertedAt: { type: Date, default: null },
    // Optional pre-existing contact this lead is linked to.
    linkedContact: { type: Schema.Types.ObjectId, ref: 'Contact', default: null },
  },
  { timestamps: true },
);

// tenantScopePlugin FIRST — adds tenantId field before audit hooks reference it.
LeadSchema.plugin(tenantScopePlugin);
LeadSchema.plugin(softDeletePlugin);
LeadSchema.plugin(auditFieldsPlugin);
LeadSchema.plugin(auditLogPlugin, { collectionName: 'leads' });

// Tenant-first composite indexes for the most common list queries.
LeadSchema.index({ tenantId: 1, businessUnit: 1, stage: 1, createdAt: -1 });
LeadSchema.index({ tenantId: 1, businessUnit: 1, source: 1 });
LeadSchema.index({ tenantId: 1, businessUnit: 1, assignedTo: 1, stage: 1 });
LeadSchema.index({ tenantId: 1, businessUnit: 1, createdAt: -1 });
LeadSchema.index({ email: 1 }, { sparse: true });
LeadSchema.index({ firstName: 'text', lastName: 'text', email: 'text', companyName: 'text' });

export type LeadDoc = InferSchemaType<typeof LeadSchema> & {
  _id: mongoose.Types.ObjectId;
  // tenantScopePlugin adds this field dynamically via schema.add(); InferSchemaType
  // doesn't see plugin-added fields, so we augment the type here.
  tenantId: mongoose.Types.ObjectId;
};

export const Lead: Model<LeadDoc> =
  (mongoose.models.Lead as Model<LeadDoc>) ?? mongoose.model<LeadDoc>('Lead', LeadSchema);

export function serializeLead(doc: Record<string, unknown>) {
  const stringify = (v: unknown): string | null => (v == null ? null : String(v));
  const isoDate = (v: unknown): string | null =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  const isoDateRequired = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);

  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    firstName: doc.firstName as string,
    lastName: doc.lastName as string,
    email: stringify(doc.email),
    phone: stringify(doc.phone),
    source: doc.source as string,
    stage: doc.stage as string,
    businessUnit: doc.businessUnit as string,
    assignedTo: stringify(doc.assignedTo),
    companyName: stringify(doc.companyName),
    jobTitle: stringify(doc.jobTitle),
    value: (doc.value as number | null | undefined) ?? null,
    expectedCloseDate: isoDate(doc.expectedCloseDate),
    notes: stringify(doc.notes),
    tags: (doc.tags as string[]) ?? [],
    convertedToCase: stringify(doc.convertedToCase),
    convertedAt: isoDate(doc.convertedAt),
    linkedContact: stringify(doc.linkedContact),
    createdBy: stringify(doc.createdBy),
    updatedBy: stringify(doc.updatedBy),
    createdAt: isoDateRequired(doc.createdAt),
    updatedAt: isoDateRequired(doc.updatedAt),
  };
}
