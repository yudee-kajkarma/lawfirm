// lib/tenancy/tenantSymbol.ts
//
// Leaf module — intentionally zero imports so it can be imported by BOTH
// tenantScopePlugin.ts (applied at schema-definition time) AND tenantModels.ts
// (which imports the schemas) without creating a circular dependency.
//
// Symbol.for() guarantees the same identity across HMR reloads.

/**
 * Marker symbol planted on a schema by `tenantScopePlugin` so the CI invariant
 * test can verify that every registered model actually has the plugin applied.
 */
export const TENANT_SCOPE_PLUGIN_SYMBOL = Symbol.for('instapath.tenantScopePlugin');
