import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';
import { tenantScopePlugin } from '../db/tenantScopePlugin';

/**
 * One item per case. Kept in its own collection (vs. embedded in Case) so
 * individual completions are audited as discrete events and so future
 * features (per-item assignees, comments, attachments) have a place to grow.
 */
const CaseChecklistSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    businessUnit: { type: String, required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 1000 },

    completed: { type: Boolean, default: false, index: true },
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    dueDate: { type: Date, default: null },
    // Ordering within a case's checklist — lower renders first.
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// tenantScopePlugin FIRST — adds tenantId field before audit hooks reference it.
CaseChecklistSchema.plugin(tenantScopePlugin);
CaseChecklistSchema.plugin(softDeletePlugin);
CaseChecklistSchema.plugin(auditFieldsPlugin);
CaseChecklistSchema.plugin(auditLogPlugin, { collectionName: 'caseChecklists' });

// caseId is already tenant-scoped transitively (Case has tenantId), but we
// still include tenantId in the leading position so the guard is satisfied.
CaseChecklistSchema.index({ tenantId: 1, caseId: 1, order: 1 });

export type CaseChecklistDoc = InferSchemaType<typeof CaseChecklistSchema> & {
  _id: mongoose.Types.ObjectId;
  // tenantScopePlugin adds this field dynamically via schema.add(); InferSchemaType
  // doesn't see plugin-added fields, so we augment the type here.
  tenantId: mongoose.Types.ObjectId;
};

export const CaseChecklist: Model<CaseChecklistDoc> =
  (mongoose.models.CaseChecklist as Model<CaseChecklistDoc>) ??
  mongoose.model<CaseChecklistDoc>('CaseChecklist', CaseChecklistSchema);
