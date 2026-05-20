import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';

/**
 * Admin-configurable Kanban columns per BU. Wired up in Phase 5 (pipeline
 * board); model lives here now so the schema is stable.
 *
 * Note: the `LEAD_STAGES` enum in `constants/enums.ts` is the *fallback* set
 * used by Lead validation when no per-BU stages exist. PipelineStage rows
 * override and extend that for richer per-BU pipelines.
 */
const PipelineStageSchema = new Schema(
  {
    businessUnit: { type: String, required: true, index: true },
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: null, maxlength: 500 },
    color: { type: String, default: '#64748b' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // Maps to a LEAD_STAGES enum value when a built-in stage is being
    // customized; null for fully custom stages.
    builtInStage: { type: String, default: null },
  },
  { timestamps: true },
);

PipelineStageSchema.plugin(softDeletePlugin);
PipelineStageSchema.plugin(auditFieldsPlugin);
PipelineStageSchema.plugin(auditLogPlugin, { collectionName: 'pipelineStages' });

PipelineStageSchema.index({ businessUnit: 1, key: 1 }, { unique: true });
PipelineStageSchema.index({ businessUnit: 1, order: 1 });

export type PipelineStageDoc = InferSchemaType<typeof PipelineStageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PipelineStage: Model<PipelineStageDoc> =
  (mongoose.models.PipelineStage as Model<PipelineStageDoc>) ??
  mongoose.model<PipelineStageDoc>('PipelineStage', PipelineStageSchema);
