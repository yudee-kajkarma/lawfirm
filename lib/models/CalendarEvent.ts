import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

import { POLY_RELATED_TYPES } from '../constants/enums';
import { auditFieldsPlugin } from '../db/auditFieldsPlugin';
import { auditLogPlugin } from '../db/auditLogPlugin';
import { softDeletePlugin } from '../db/softDeletePlugin';

const RelatedToSchema = new Schema(
  {
    type: { type: String, enum: POLY_RELATED_TYPES, required: true },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const CalendarEventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 5000 },

    /** UTC. The client converts to/from the user's local timezone. */
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    allDay: { type: Boolean, default: false },

    location: { type: String, default: null, maxlength: 300 },
    meetingUrl: { type: String, default: null, maxlength: 1000 },

    businessUnit: { type: String, required: true, index: true },
    relatedTo: { type: RelatedToSchema, default: null },

    /** Hex override. When null, the UI falls back to the BU colour. */
    color: { type: String, default: null },

    /** Per-event participants — User refs. Picker UI lands with Phase 13. */
    attendees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

CalendarEventSchema.plugin(softDeletePlugin);
CalendarEventSchema.plugin(auditFieldsPlugin);
CalendarEventSchema.plugin(auditLogPlugin, { collectionName: 'calendarEvents' });

// Compound polymorphic index (CLAUDE.md §3.5).
CalendarEventSchema.index({ 'relatedTo.type': 1, 'relatedTo.id': 1 });

// The list endpoint's hot path: events in `[start, end]` for a BU.
CalendarEventSchema.index({ businessUnit: 1, startsAt: 1, endsAt: 1 });

export type CalendarEventDoc = InferSchemaType<typeof CalendarEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CalendarEvent: Model<CalendarEventDoc> =
  (mongoose.models.CalendarEvent as Model<CalendarEventDoc>) ??
  mongoose.model<CalendarEventDoc>('CalendarEvent', CalendarEventSchema);

export function serializeCalendarEvent(doc: Record<string, unknown>) {
  const stringify = (v: unknown): string | null => (v == null ? null : String(v));
  const isoDate = (v: unknown): string | null =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  const isoDateRequired = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);

  const relatedTo = doc.relatedTo as { type: string; id: unknown } | null | undefined;
  const attendees = (doc.attendees as unknown[] | undefined) ?? [];

  return {
    _id: String(doc._id),
    title: doc.title as string,
    description: stringify(doc.description),
    startsAt: isoDateRequired(doc.startsAt),
    endsAt: isoDateRequired(doc.endsAt),
    allDay: Boolean(doc.allDay),
    location: stringify(doc.location),
    meetingUrl: stringify(doc.meetingUrl),
    businessUnit: doc.businessUnit as string,
    relatedTo: relatedTo ? { type: relatedTo.type, id: String(relatedTo.id) } : null,
    color: stringify(doc.color),
    attendees: attendees.map((a) => String(a)),
    createdBy: stringify(doc.createdBy),
    updatedBy: stringify(doc.updatedBy),
    createdAt: isoDate(doc.createdAt) ?? new Date().toISOString(),
    updatedAt: isoDate(doc.updatedAt) ?? new Date().toISOString(),
  };
}
