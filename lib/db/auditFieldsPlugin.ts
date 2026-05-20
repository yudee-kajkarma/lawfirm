import { Schema, Types } from 'mongoose';

import { getContext } from '../auth/requestContext';

/**
 * Adds `createdBy` and `updatedBy` ObjectId fields (refs to User) and
 * populates them from the request context. Skipped silently when no
 * context is present (e.g., seed scripts running outside `runWithContext`).
 */
export function auditFieldsPlugin(schema: Schema): void {
  schema.add({
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  });

  schema.pre('save', function () {
    const ctx = getContext();
    const userId =
      ctx?.user?._id && Types.ObjectId.isValid(ctx.user._id)
        ? new Types.ObjectId(ctx.user._id)
        : null;
    if (!userId) return;

    if (this.isNew && !this.get('createdBy')) {
      this.set('createdBy', userId);
    }
    if (this.isModified()) {
      this.set('updatedBy', userId);
    }
  });

  schema.pre('findOneAndUpdate', function () {
    const ctx = getContext();
    const userId =
      ctx?.user?._id && Types.ObjectId.isValid(ctx.user._id)
        ? new Types.ObjectId(ctx.user._id)
        : null;
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).set({ updatedBy: userId });
  });
}
