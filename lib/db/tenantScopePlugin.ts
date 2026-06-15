import { Schema } from 'mongoose';

import { TENANT_SCOPE_PLUGIN_SYMBOL } from '../tenancy/tenantSymbol';

/**
 * Mongoose plugin that adds `tenantId: ObjectId` (required, indexed) to the
 * schema and REFUSES to run any query that doesn't include `tenantId` in its
 * filter — throws loudly. A forgotten `tenantId` is a screaming error in dev,
 * not a silent leak in prod.
 *
 * Opt out explicitly with `.setOptions({ __crossTenant: true })` for legitimate
 * cross-tenant code (operator console, the purge sweep). That flag is grep-able;
 * every occurrence outside `app/api/operator/**` and `scripts/**` is a review
 * red flag.
 *
 * Aggregations bypass middleware — use `tenantAggregate()` instead of
 * `Model.aggregate(...)`. The eslint rule in `eslint.config.mjs` enforces this.
 *
 * Pass `{ uniqueTenant: true }` for singleton-per-tenant collections (e.g.
 * Settings) so the auto-added tenantId index is unique rather than non-unique.
 */

declare module 'mongoose' {
  interface QueryOptions {
    __crossTenant?: boolean;
  }
}

export type TenantScopePluginOptions = {
  /**
   * If true, the auto-added `tenantId` index is unique. Use for tenant-singleton
   * collections (Settings) where exactly one doc per tenant is required.
   * Default: false (non-unique).
   */
  uniqueTenant?: boolean;
};

export function tenantScopePlugin(schema: Schema, options: TenantScopePluginOptions = {}): void {
  // Build the tenantId field descriptor conditionally.
  // When uniqueTenant is true we set ONLY `unique: true` — omitting `index`
  // entirely — because Mongoose rejects the combination of `index: false` +
  // `unique: true` (a unique constraint already implies an index). When
  // uniqueTenant is false (the default) we set ONLY `index: true` and leave
  // `unique` absent, avoiding a second schema-level index declaration that
  // would trigger the "Duplicate schema index" warning.
  const tenantIdField: Record<string, unknown> = {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  };
  if (options.uniqueTenant) {
    tenantIdField.unique = true;
  } else {
    tenantIdField.index = true;
  }
  schema.add({ tenantId: tenantIdField });

  // Tag the schema so the CI invariant test can verify plugin application.
  // Using Object.defineProperty + symbol so it isn't enumerated by anything.
  Object.defineProperty(schema, TENANT_SCOPE_PLUGIN_SYMBOL, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  // `this` is a Mongoose Query whose concrete generic varies per op — `any`
  // keeps the helper reusable. Same pattern as softDeletePlugin.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function requireTenantId(this: any): void {
    const opts = this.getOptions();
    if (opts.__crossTenant) return;
    const filter = this.getQuery();
    if (filter.tenantId === undefined) {
      const modelName =
        (this.model && this.model.modelName) || (this.mongooseCollection?.name ?? 'unknown');
      throw new Error(
        `[tenantScopePlugin] query on "${modelName}" is missing tenantId. ` +
          `Use scopedQuery(user) to build the filter, or set __crossTenant: true ` +
          `explicitly for cross-tenant operator code.`,
      );
    }
  }

  schema.pre('find', requireTenantId);
  schema.pre('findOne', requireTenantId);
  // 'count' was removed in Mongoose 9; countDocuments is the current API.
  schema.pre('countDocuments', requireTenantId);
  schema.pre('updateOne', requireTenantId);
  schema.pre('updateMany', requireTenantId);
  schema.pre('deleteOne', requireTenantId);
  schema.pre('deleteMany', requireTenantId);
  schema.pre('findOneAndUpdate', requireTenantId);
}
