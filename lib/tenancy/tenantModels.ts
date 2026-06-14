// lib/tenancy/tenantModels.ts
import type { Model } from 'mongoose';

/**
 * Marker symbol planted on a schema by `tenantScopePlugin` so the CI invariant
 * test can verify that every registered model actually has the plugin applied.
 * Symbol.for() guarantees the same identity across HMR reloads.
 */
export const TENANT_SCOPE_PLUGIN_SYMBOL = Symbol.for('instapath.tenantScopePlugin');

/**
 * Single source of truth for "every model that carries `tenantId`".
 *
 * Used by:
 *  - the purge pipeline (iterates this list to wipe a tenant)
 *  - the CI invariant test (asserts every model in here has `tenantScopePlugin`
 *    AND a tenant-first compound index, and conversely that every model with
 *    a `tenantId` schema path is in this list)
 *
 * Empty in MT-0 by design. MT-1 stamps `tenantId` onto each business model
 * and adds it here in the same change.
 *
 * `Tenant` itself is NEVER added here — it sits above the tenant hierarchy
 * and is deleted last (by hand) after the registry-iterated sweep completes.
 */
// Heterogeneous models (Lead, Case, Contact …) cannot share a common generic —
// Mongoose 9 has no `Model<unknown>` that is assignable from all of them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TENANT_MODELS: ReadonlyArray<{ model: Model<any>; label: string }> = [
  // MT-1 will populate this list. See spec §6.1.
] as const;
