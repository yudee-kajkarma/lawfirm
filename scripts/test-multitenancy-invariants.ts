/**
 * MT-0 CI invariant test — the mechanical guarantee from spec §4.4.
 *
 * Asserts:
 *   1. Every model with a `tenantId` schema path is registered in TENANT_MODELS.
 *   2. Every model in TENANT_MODELS has `tenantScopePlugin` applied (symbol tag).
 *   3. Every model in TENANT_MODELS has at least one compound index whose
 *      first key is `tenantId`.
 *
 * In MT-0 the registry is empty, so this test trivially passes. The point is
 * to have it WIRED UP — the moment MT-1 adds the first model to TENANT_MODELS,
 * all three invariants are enforced. CI failure on this script is the signal
 * "you added a tenant-scoped model and missed a step".
 *
 * Run with: npm run test:multitenancy
 */

import mongoose from 'mongoose';

import {
  TENANT_MODELS,
  TENANT_SCOPE_PLUGIN_SYMBOL,
} from '../lib/tenancy/tenantModels';

// Side-effect import: register every model with Mongoose.
// We have to import them one-by-one because there is no barrel file.
import '../lib/models/User';
import '../lib/models/BusinessUnit';
import '../lib/models/Contact';
import '../lib/models/Lead';
import '../lib/models/Case';
import '../lib/models/CaseChecklist';
import '../lib/models/PipelineStage';
import '../lib/models/Task';
import '../lib/models/Document';
import '../lib/models/CalendarEvent';
import '../lib/models/SmartList';
import '../lib/models/Invoice';
import '../lib/models/Counter';
import '../lib/models/Settings';
import '../lib/models/AuditLog';
import '../lib/models/Tenant';

const errors: string[] = [];

function check(label: string, ok: boolean, detail: string): void {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label} — ${detail}`);
    errors.push(`${label}: ${detail}`);
  }
}

console.log('\nMT-0 multi-tenancy invariants\n');

// 1. Every model with a tenantId path is in TENANT_MODELS.
{
  const registered = new Set(TENANT_MODELS.map(({ model }) => model.modelName));
  const offenders: string[] = [];
  for (const [name, model] of Object.entries(mongoose.models)) {
    if (model.schema.path('tenantId') && !registered.has(name)) {
      offenders.push(name);
    }
  }
  check(
    'every model with `tenantId` is in TENANT_MODELS',
    offenders.length === 0,
    `offenders: ${offenders.join(', ') || '(none)'}`,
  );
}

// 2. Every model in TENANT_MODELS has tenantScopePlugin applied.
{
  const missing: string[] = [];
  for (const { model } of TENANT_MODELS) {
    const tagged = (model.schema as unknown as Record<symbol, unknown>)[
      TENANT_SCOPE_PLUGIN_SYMBOL
    ];
    if (!tagged) missing.push(model.modelName);
  }
  check(
    'every TENANT_MODELS entry has tenantScopePlugin applied',
    missing.length === 0,
    `missing plugin: ${missing.join(', ') || '(none)'}`,
  );
}

// 3. Every TENANT_MODELS entry has a tenant-first compound index.
{
  const offenders: string[] = [];
  for (const { model, label } of TENANT_MODELS) {
    // schema.indexes() returns [fields, options] tuples for compound indexes.
    const indexes = model.schema.indexes();
    const hasTenantFirst = indexes.some(([fields]: [Record<string, unknown>]) => {
      const firstKey = Object.keys(fields)[0];
      return firstKey === 'tenantId';
    });
    if (!hasTenantFirst) offenders.push(`${model.modelName} (${label})`);
  }
  check(
    'every TENANT_MODELS entry has a tenant-first compound index',
    offenders.length === 0,
    `offenders: ${offenders.join(', ') || '(none)'}`,
  );
}

console.log(
  `\n  ${errors.length === 0 ? '✓ all invariants hold' : `✗ ${errors.length} invariant(s) violated`}\n`,
);
process.exit(errors.length === 0 ? 0 : 1);
