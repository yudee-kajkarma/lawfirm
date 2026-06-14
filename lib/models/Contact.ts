import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { CONTACT_TYPES } from '../constants/enums';
import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';
import { tenantScopePlugin } from '../db/tenantScopePlugin';

const AddressSchema = new Schema(
  {
    street: { type: String, default: null, trim: true },
    city: { type: String, default: null, trim: true },
    state: { type: String, default: null, trim: true },
    postalCode: { type: String, default: null, trim: true },
    country: { type: String, default: null, trim: true },
  },
  { _id: false },
);

const ContactSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, lowercase: true, trim: true, default: null, maxlength: 200 },
    phone: { type: String, trim: true, default: null, maxlength: 40 },
    contactType: {
      type: String,
      enum: CONTACT_TYPES,
      default: 'client',
      required: true,
      index: true,
    },
    businessUnit: { type: String, required: true, index: true },
    companyName: { type: String, default: null, trim: true, maxlength: 200 },
    jobTitle: { type: String, default: null, trim: true, maxlength: 200 },
    address: { type: AddressSchema, default: null },
    tags: { type: [String], default: [] },
    notes: { type: String, default: null, maxlength: 5000 },
    customFields: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
  },
  { timestamps: true },
);

// tenantScopePlugin FIRST — adds tenantId field before audit hooks reference it.
ContactSchema.plugin(tenantScopePlugin);
ContactSchema.plugin(softDeletePlugin);
ContactSchema.plugin(auditFieldsPlugin);
ContactSchema.plugin(auditLogPlugin, { collectionName: 'contacts' });

// Composite indexes for the common access patterns the list endpoint will use.
// All leading with tenantId so every query is tenant-scoped from the index root.
ContactSchema.index({ tenantId: 1, businessUnit: 1, contactType: 1 });
ContactSchema.index({ tenantId: 1, businessUnit: 1, createdAt: -1 });
ContactSchema.index({ email: 1 }, { sparse: true });
// Text index lets us upgrade to `$text` search later without re-indexing.
ContactSchema.index({ firstName: 'text', lastName: 'text', email: 'text', companyName: 'text' });

export type ContactDoc = InferSchemaType<typeof ContactSchema> & {
  _id: mongoose.Types.ObjectId;
  // tenantScopePlugin adds this field dynamically via schema.add(); InferSchemaType
  // doesn't see plugin-added fields, so we augment the type here.
  tenantId: mongoose.Types.ObjectId;
};

export const Contact: Model<ContactDoc> =
  (mongoose.models.Contact as Model<ContactDoc>) ??
  mongoose.model<ContactDoc>('Contact', ContactSchema);

/**
 * Convert a Mongoose-leaned/hydrated Contact into the JSON-safe wire shape
 * (ObjectIds → strings, Dates → ISO strings, customFields stripped). Use this
 * at every API boundary so the client always sees `string` ids/dates.
 */
export function serializeContact(doc: Record<string, unknown>): {
  _id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  contactType: string;
  businessUnit: string;
  companyName: string | null;
  jobTitle: string | null;
  address: Record<string, string | null> | null;
  tags: string[];
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
} {
  const get = <T>(key: string): T => doc[key] as T;
  const stringify = (v: unknown): string | null => (v == null ? null : String(v));
  const isoDate = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));

  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    firstName: get<string>('firstName'),
    lastName: get<string>('lastName'),
    email: stringify(get<unknown>('email')),
    phone: stringify(get<unknown>('phone')),
    contactType: get<string>('contactType'),
    businessUnit: get<string>('businessUnit'),
    companyName: stringify(get<unknown>('companyName')),
    jobTitle: stringify(get<unknown>('jobTitle')),
    address: (get<Record<string, string | null> | null>('address')) ?? null,
    tags: (get<string[]>('tags')) ?? [],
    notes: stringify(get<unknown>('notes')),
    createdBy: stringify(get<unknown>('createdBy')),
    updatedBy: stringify(get<unknown>('updatedBy')),
    createdAt: isoDate(get<unknown>('createdAt')),
    updatedAt: isoDate(get<unknown>('updatedAt')),
  };
}
