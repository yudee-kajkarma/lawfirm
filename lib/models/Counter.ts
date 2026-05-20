import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * Atomic sequence generator. One document per logical key
 * (e.g. `case:law:2026`, `invoice:immigration:2026`).
 *
 * Updates use `findOneAndUpdate({ key }, { $inc: { value: 1 } }, { upsert: true })`
 * which is atomic on a single document. When called inside a Mongoose
 * `session.withTransaction(...)`, the increment is part of the transaction —
 * rolls back if the transaction aborts, retries on WriteConflict.
 *
 * No plugins applied: this is internal mechanism, not user-facing.
 */
const CounterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type CounterDoc = InferSchemaType<typeof CounterSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Counter: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) ??
  mongoose.model<CounterDoc>('Counter', CounterSchema);
