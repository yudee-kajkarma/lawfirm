import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { tenantScopePlugin } from '../db/tenantScopePlugin';

/**
 * Atomic sequence generator. One document per logical key per tenant
 * (e.g. `case:law:2026`, `invoice:immigration:2026`).
 *
 * Updates use `findOneAndUpdate({ tenantId, key }, { $inc: { value: 1 } }, { upsert: true })`
 * which is atomic on a single document. When called inside a Mongoose
 * `session.withTransaction(...)`, the increment is part of the transaction —
 * rolls back if the transaction aborts, retries on WriteConflict.
 *
 * No softDelete/auditFields/auditLog plugins: this is an internal mechanism,
 * not a user-facing record. Only tenantScopePlugin is applied to isolate
 * sequence namespaces across tenants.
 */
const CounterSchema = new Schema(
  {
    // `tenantId` is injected by tenantScopePlugin. NOT globally unique — see index below.
    key: { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// tenantScopePlugin only — no audit or soft-delete on this internal collection.
CounterSchema.plugin(tenantScopePlugin);

// Per-tenant key uniqueness replaces the old global unique constraint.
CounterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export type CounterDoc = InferSchemaType<typeof CounterSchema> & {
  _id: mongoose.Types.ObjectId;
  // tenantScopePlugin adds this field dynamically via schema.add(); InferSchemaType
  // doesn't see plugin-added fields, so we augment the type here.
  tenantId: mongoose.Types.ObjectId;
};

export const Counter: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) ??
  mongoose.model<CounterDoc>('Counter', CounterSchema);
