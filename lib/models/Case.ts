import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { CASE_STATUSES } from '../constants/enums';
import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';
import { tenantScopePlugin } from '../db/tenantScopePlugin';

const CaseSchema = new Schema(
  {
    // Human-readable number, format `<BU>-<YEAR>-<SEQ>` e.g. LAW-2026-0001.
    // Generated via `generateCaseNumber()` — never set by hand.
    caseNumber: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 5000 },

    // Free-form per BU (e.g. 'H1B', 'civil_litigation'). Admin-customizable
    // case-type registry arrives in Phase 13 (settings).
    caseType: { type: String, default: null, maxlength: 100 },
    status: { type: String, enum: CASE_STATUSES, default: 'open', required: true, index: true },

    businessUnit: { type: String, required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    openedAt: { type: Date, default: () => new Date() },
    closedAt: { type: Date, default: null },

    value: { type: Number, default: null, min: 0 },

    convertedFromLead: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },

    tags: { type: [String], default: [] },
    customFields: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
  },
  { timestamps: true },
);

// tenantScopePlugin FIRST — adds tenantId field before audit hooks reference it.
CaseSchema.plugin(tenantScopePlugin);
CaseSchema.plugin(softDeletePlugin);
CaseSchema.plugin(auditFieldsPlugin);
CaseSchema.plugin(auditLogPlugin, { collectionName: 'cases' });

CaseSchema.index({ tenantId: 1, businessUnit: 1, status: 1, createdAt: -1 });
CaseSchema.index({ tenantId: 1, businessUnit: 1, assignedTo: 1 });
CaseSchema.index({ tenantId: 1, businessUnit: 1, clientId: 1 });
CaseSchema.index({ tenantId: 1, caseNumber: 1 }, { unique: true });
CaseSchema.index({ caseNumber: 'text', title: 'text', description: 'text' });

export type CaseDoc = InferSchemaType<typeof CaseSchema> & {
  _id: mongoose.Types.ObjectId;
  // tenantScopePlugin adds this field dynamically via schema.add(); InferSchemaType
  // doesn't see plugin-added fields, so we augment the type here.
  tenantId: mongoose.Types.ObjectId;
};

export const Case: Model<CaseDoc> =
  (mongoose.models.Case as Model<CaseDoc>) ?? mongoose.model<CaseDoc>('Case', CaseSchema);

export function serializeCase(doc: Record<string, unknown>) {
  const stringify = (v: unknown): string | null => (v == null ? null : String(v));
  const isoDate = (v: unknown): string | null =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  const isoDateRequired = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);

  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    caseNumber: doc.caseNumber as string,
    title: doc.title as string,
    description: stringify(doc.description),
    caseType: stringify(doc.caseType),
    status: doc.status as string,
    businessUnit: doc.businessUnit as string,
    clientId: stringify(doc.clientId),
    assignedTo: stringify(doc.assignedTo),
    openedAt: isoDate(doc.openedAt),
    closedAt: isoDate(doc.closedAt),
    value: (doc.value as number | null | undefined) ?? null,
    convertedFromLead: stringify(doc.convertedFromLead),
    tags: (doc.tags as string[]) ?? [],
    createdBy: stringify(doc.createdBy),
    updatedBy: stringify(doc.updatedBy),
    createdAt: isoDateRequired(doc.createdAt),
    updatedAt: isoDateRequired(doc.updatedAt),
  };
}
