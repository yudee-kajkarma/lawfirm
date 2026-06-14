import { Types, type Schema } from 'mongoose';

import { getContext } from '../auth/requestContext';
import type { AuditAction } from '../constants/enums';
import { AuditLog } from '../models/AuditLog';

type AuditLogOptions = {
  collectionName: string;
  /** Top-level paths to omit from the diff (e.g., 'passwordHash', 'integrations'). */
  excludePaths?: string[];
};

/**
 * Logs field-level diffs to the `auditLogs` collection on every save
 * (create / update / soft-delete / restore). Reads the actor from
 * AsyncLocalStorage — see `lib/auth/requestContext.ts`.
 *
 * IMPORTANT: only hooks `.save()`-based mutations. Bulk ops (`updateMany`,
 * `findOneAndUpdate`, raw driver writes) bypass this — see CLAUDE.md §3.3.
 * Use the "fetch + .save()" pattern for any mutation that needs to be audited.
 */

// Mongoose internals + timestamps that aren't meaningful in a diff.
const BASE_EXCLUDED = new Set(['_id', '__v', 'updatedAt', 'updatedBy', 'createdAt']);

type Change = { path: string; before: unknown; after: unknown };

function diffObjects(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  excluded: Set<string>,
): Change[] {
  const changes: Change[] = [];
  if (!before) {
    for (const [k, v] of Object.entries(after)) {
      if (excluded.has(k)) continue;
      if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) continue;
      changes.push({ path: k, before: null, after: v });
    }
    return changes;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (excluded.has(k)) continue;
    const b = before[k];
    const a = after[k];
    if (JSON.stringify(b ?? null) !== JSON.stringify(a ?? null)) {
      changes.push({ path: k, before: b ?? null, after: a ?? null });
    }
  }
  return changes;
}

export function auditLogPlugin(schema: Schema, options: AuditLogOptions): void {
  const { collectionName, excludePaths = [] } = options;
  const excluded = new Set([...BASE_EXCLUDED, ...excludePaths]);

  schema.pre('save', async function () {
    if (!this.isNew) {
      const Model = this.constructor as unknown as {
        findOne: (filter: Record<string, unknown>) => { lean: () => Promise<Record<string, unknown> | null> };
      };
      // Include tenantId in the filter so tenantScopePlugin doesn't reject
      // this internal lookup. The doc's own tenantId is always present here
      // because save() runs after the field is populated.
      const tenantFilter: Record<string, unknown> = { _id: this._id };
      const docTenantId = (this as unknown as { tenantId?: unknown }).tenantId;
      if (docTenantId !== undefined) {
        tenantFilter.tenantId = docTenantId;
      }
      const original = await Model.findOne(tenantFilter).lean();
      (this as unknown as { $locals: Record<string, unknown> }).$locals.__auditOriginal = original;
    }
  });

  schema.post('save', async function (doc) {
    const original = (doc as unknown as { $locals?: Record<string, unknown> }).$locals?.__auditOriginal as
      | Record<string, unknown>
      | undefined;
    const isCreate = !original;

    let action: AuditAction = 'create';
    if (!isCreate) {
      const wasDeleted = original?.deletedAt != null;
      const isDeleted = (doc as unknown as { deletedAt: Date | null }).deletedAt != null;
      if (!wasDeleted && isDeleted) action = 'delete';
      else if (wasDeleted && !isDeleted) action = 'restore';
      else action = 'update';
    }

    const afterObj = (
      doc as unknown as { toObject: (opts: object) => Record<string, unknown> }
    ).toObject({ virtuals: false, depopulate: true });
    const changes = diffObjects(original ?? null, afterObj, excluded);

    // Skip no-op saves (e.g., .save() with no modifications, or only excluded
    // paths changed like a login bumping lastLoginAt).
    if (action === 'update' && changes.length === 0) return;

    const ctx = getContext();

    // Diagnostic — a 'user' source mutation with no actor means the route
    // bypassed `withAuth`. We've seen this happen during dev HMR around
    // server actions. Loud warn so it's caught immediately.
    if (!ctx) {
      console.warn(
        `[auditLogPlugin] save fired with no request context (collection=${collectionName}, id=${String(doc._id)}). The route likely bypassed withAuth.`,
      );
    }

    const actorId =
      ctx?.user?._id && Types.ObjectId.isValid(ctx.user._id)
        ? new Types.ObjectId(ctx.user._id)
        : null;

    // Resolve tenantId — prefer the audited doc's own tenantId; fall back to the
    // actor's tenantId from requestContext (used for Tenant model edits, whose
    // doc has no tenantId of its own — the actor's tenant is the right scope).
    const docTenant = (doc as unknown as { tenantId?: unknown }).tenantId;
    const ctxTenant = ctx?.user?.tenantId;
    const tenantId =
      docTenant && Types.ObjectId.isValid(String(docTenant))
        ? new Types.ObjectId(String(docTenant))
        : ctxTenant && Types.ObjectId.isValid(ctxTenant)
          ? new Types.ObjectId(ctxTenant)
          : null;

    // Skip audit entry if we can't resolve a tenant — AuditLog now requires
    // tenantId (tenantScopePlugin makes it required). Null happens only for
    // Tenant-model mutations (operator-console territory), which will get their
    // own audit solution in Phase 2. The outer try/catch already prevents audit
    // failures from breaking the main mutation, but it's cleaner to skip
    // deliberately than to swallow a Mongoose validation error silently.
    if (!tenantId) return;

    try {
      await AuditLog.create({
        collectionName,
        documentId: doc._id as Types.ObjectId,
        tenantId,
        action,
        actorId,
        actorEmail: ctx?.user?.email ?? null,
        source: ctx?.source ?? 'system',
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        businessUnit: (doc as unknown as { businessUnit?: string }).businessUnit ?? null,
        changes,
      });
    } catch (err) {
      // Audit logging must never break the main mutation. Surface loudly so
      // it's not silently swallowed in production logs.
      console.error('[auditLogPlugin] failed to write entry', {
        collectionName,
        documentId: String(doc._id),
        err,
      });
    }
  });
}
