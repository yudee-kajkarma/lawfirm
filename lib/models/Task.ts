import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { POLY_RELATED_TYPES, TASK_PRIORITIES, TASK_STATUSES } from '../constants/enums';
import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';
import { tenantScopePlugin } from '../db/tenantScopePlugin';

/**
 * Polymorphic attach-anywhere shape used by tasks, documents, threads,
 * activities, etc. (CLAUDE.md §3.5). Both fields required if `relatedTo`
 * exists; the parent doc itself can have `relatedTo: null` for standalone
 * tasks.
 */
const RelatedToSchema = new Schema(
  {
    type: { type: String, enum: POLY_RELATED_TYPES, required: true },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const TaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 5000 },

    status: { type: String, enum: TASK_STATUSES, default: 'todo', required: true, index: true },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: 'medium',
      required: true,
      index: true,
    },

    businessUnit: { type: String, required: true, index: true },

    relatedTo: { type: RelatedToSchema, default: null },

    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    tags: { type: [String], default: [] },
    customFields: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
  },
  { timestamps: true },
);

// tenantScopePlugin FIRST — adds tenantId field before audit hooks reference it.
TaskSchema.plugin(tenantScopePlugin);
TaskSchema.plugin(softDeletePlugin);
TaskSchema.plugin(auditFieldsPlugin);
TaskSchema.plugin(auditLogPlugin, { collectionName: 'tasks' });

// The canonical polymorphic-relation compound index from CLAUDE.md §3.5.
// The relatedTo fields don't start with businessUnit, so we leave them as-is
// (they are already filtered by tenantId via the query guard).
TaskSchema.index({ 'relatedTo.type': 1, 'relatedTo.id': 1 });

// Tenant-first composite indexes for common list patterns.
TaskSchema.index({ tenantId: 1, businessUnit: 1, status: 1, dueDate: 1 });
TaskSchema.index({ tenantId: 1, businessUnit: 1, assignedTo: 1, status: 1 });
TaskSchema.index({ tenantId: 1, businessUnit: 1, createdAt: -1 });

export type TaskDoc = InferSchemaType<typeof TaskSchema> & {
  _id: mongoose.Types.ObjectId;
  // tenantScopePlugin adds this field dynamically via schema.add(); InferSchemaType
  // doesn't see plugin-added fields, so we augment the type here.
  tenantId: mongoose.Types.ObjectId;
};

export const Task: Model<TaskDoc> =
  (mongoose.models.Task as Model<TaskDoc>) ?? mongoose.model<TaskDoc>('Task', TaskSchema);

export function serializeTask(doc: Record<string, unknown>) {
  const stringify = (v: unknown): string | null => (v == null ? null : String(v));
  const isoDate = (v: unknown): string | null =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  const isoDateRequired = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);

  const relatedTo = doc.relatedTo as { type: string; id: unknown } | null | undefined;

  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    title: doc.title as string,
    description: stringify(doc.description),
    status: doc.status as string,
    priority: doc.priority as string,
    businessUnit: doc.businessUnit as string,
    relatedTo: relatedTo
      ? { type: relatedTo.type, id: String(relatedTo.id) }
      : null,
    assignedTo: stringify(doc.assignedTo),
    dueDate: isoDate(doc.dueDate),
    completedAt: isoDate(doc.completedAt),
    completedBy: stringify(doc.completedBy),
    tags: (doc.tags as string[]) ?? [],
    createdBy: stringify(doc.createdBy),
    updatedBy: stringify(doc.updatedBy),
    createdAt: isoDateRequired(doc.createdAt),
    updatedAt: isoDateRequired(doc.updatedAt),
  };
}
