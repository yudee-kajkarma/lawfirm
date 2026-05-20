import type { Schema } from 'mongoose';

/**
 * Adds `deletedAt: Date | null` to the schema and automatically filters out
 * soft-deleted records from queries. To include them, call
 * `.setOptions({ withDeleted: true })` on the query.
 *
 * Use the instance method `doc.softDelete()` to delete, `doc.restore()` to undo.
 * Never call `findByIdAndDelete` / `deleteOne` directly — those hard-delete
 * and bypass the audit log.
 */

declare module 'mongoose' {
  interface QueryOptions {
    withDeleted?: boolean;
  }
  interface Document {
    /** Set `deletedAt = now` and save. Triggers audit-log via the save hook. */
    softDelete(): Promise<this>;
    /** Clear `deletedAt` and save. Triggers audit-log via the save hook. */
    restore(): Promise<this>;
  }
}

export function softDeletePlugin(schema: Schema): void {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
  });

  // `this` is a Mongoose Query whose concrete generic varies per op — `any`
  // keeps the helper reusable across the 9 query ops we hook below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilter(this: any): void {
    const opts = this.getOptions();
    if (opts.withDeleted) return;
    const cond = this.getQuery();
    if (cond.deletedAt === undefined) {
      this.where({ deletedAt: null });
    }
  }

  schema.pre('find', applyFilter);
  schema.pre('findOne', applyFilter);
  schema.pre('findOneAndUpdate', applyFilter);
  schema.pre('countDocuments', applyFilter);
  schema.pre('updateOne', applyFilter);
  schema.pre('updateMany', applyFilter);
  schema.pre('deleteOne', applyFilter);
  schema.pre('deleteMany', applyFilter);

  schema.method('softDelete', async function (this: { deletedAt: Date | null; save: () => Promise<unknown> }) {
    this.deletedAt = new Date();
    return this.save();
  });

  schema.method('restore', async function (this: { deletedAt: Date | null; save: () => Promise<unknown> }) {
    this.deletedAt = null;
    return this.save();
  });
}
