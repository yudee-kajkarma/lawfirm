import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';
import { tenantScopePlugin } from '../db/tenantScopePlugin';
import { SMART_LIST_ENTITIES } from '../utils/smartListFields';

const SmartListSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 1000 },

    /** Which collection this filter applies to. Immutable after create. */
    entity: { type: String, enum: SMART_LIST_ENTITIES, required: true, index: true },

    businessUnit: { type: String, required: true, index: true },

    /**
     * { conjunction: 'and' | 'or', conditions: [...] }. Stored as Mixed so
     * the shape can evolve (e.g. add nested groups later) without a schema
     * migration. Validated at the boundary via Zod + the translator.
     */
    filterTree: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

// tenantScopePlugin FIRST — adds tenantId field before audit hooks reference it.
SmartListSchema.plugin(tenantScopePlugin);
SmartListSchema.plugin(softDeletePlugin);
SmartListSchema.plugin(auditFieldsPlugin);
SmartListSchema.plugin(auditLogPlugin, { collectionName: 'smartLists' });

SmartListSchema.index({ tenantId: 1, businessUnit: 1, entity: 1, createdAt: -1 });

export type SmartListDoc = InferSchemaType<typeof SmartListSchema> & {
  _id: mongoose.Types.ObjectId;
  // tenantScopePlugin adds this field dynamically via schema.add(); InferSchemaType
  // doesn't see plugin-added fields, so we augment the type here.
  tenantId: mongoose.Types.ObjectId;
};

export const SmartList: Model<SmartListDoc> =
  (mongoose.models.SmartList as Model<SmartListDoc>) ??
  mongoose.model<SmartListDoc>('SmartList', SmartListSchema);

export function serializeSmartList(doc: Record<string, unknown>) {
  const stringify = (v: unknown): string | null => (v == null ? null : String(v));
  const isoDateRequired = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    name: doc.name as string,
    description: stringify(doc.description),
    entity: doc.entity as string,
    businessUnit: doc.businessUnit as string,
    filterTree: doc.filterTree as unknown,
    createdBy: stringify(doc.createdBy),
    updatedBy: stringify(doc.updatedBy),
    createdAt: isoDateRequired(doc.createdAt),
    updatedAt: isoDateRequired(doc.updatedAt),
  };
}
