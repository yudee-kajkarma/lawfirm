import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';

const BusinessUnitSchema = new Schema(
  {
    // Short, lowercase, URL-safe identifier referenced from every business record
    // (`businessUnit: 'law'`). Never changes once created; admin renames affect
    // `name`, not `key`.
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    // Hex color used by status pills, sidebar accents, etc.
    color: { type: String, default: '#64748b' },
    order: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

BusinessUnitSchema.plugin(softDeletePlugin);
BusinessUnitSchema.plugin(auditFieldsPlugin);
BusinessUnitSchema.plugin(auditLogPlugin, { collectionName: 'businessUnits' });

export type BusinessUnitDoc = InferSchemaType<typeof BusinessUnitSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BusinessUnit: Model<BusinessUnitDoc> =
  (mongoose.models.BusinessUnit as Model<BusinessUnitDoc>) ??
  mongoose.model<BusinessUnitDoc>('BusinessUnit', BusinessUnitSchema);

export function serializeBusinessUnit(doc: Record<string, unknown>): {
  _id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
} {
  const isoDate = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);
  return {
    _id: String(doc._id),
    key: String(doc.key ?? ''),
    name: String(doc.name ?? ''),
    description: doc.description == null ? null : String(doc.description),
    color: String(doc.color ?? '#64748b'),
    order: Number(doc.order ?? 100),
    isActive: doc.isActive !== false,
    createdAt: isoDate(doc.createdAt),
    updatedAt: isoDate(doc.updatedAt),
  };
}
