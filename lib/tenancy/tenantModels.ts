// lib/tenancy/tenantModels.ts
import type { Model } from 'mongoose';

// Re-exported so callers (test script, etc.) can import from one place.
// The actual definition lives in tenantSymbol.ts (a zero-import leaf module)
// to avoid the circular dependency: models → tenantScopePlugin → here → models.
export { TENANT_SCOPE_PLUGIN_SYMBOL } from './tenantSymbol';

import { AuditLog } from '@/lib/models/AuditLog';
import { BusinessUnit } from '@/lib/models/BusinessUnit';
import { CalendarEvent } from '@/lib/models/CalendarEvent';
import { Case } from '@/lib/models/Case';
import { CaseChecklist } from '@/lib/models/CaseChecklist';
import { Contact } from '@/lib/models/Contact';
import { Counter } from '@/lib/models/Counter';
import { DocumentModel } from '@/lib/models/Document';
import { Invoice } from '@/lib/models/Invoice';
import { Lead } from '@/lib/models/Lead';
import { PipelineStage } from '@/lib/models/PipelineStage';
import { Settings } from '@/lib/models/Settings';
import { SmartList } from '@/lib/models/SmartList';
import { Task as TaskModel } from '@/lib/models/Task';
import { User } from '@/lib/models/User';

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
  { model: AuditLog,      label: 'auditLogs' },
  { model: BusinessUnit,  label: 'businessUnits' },
  { model: CalendarEvent, label: 'calendarEvents' },
  { model: Case,          label: 'cases' },
  { model: CaseChecklist, label: 'caseChecklists' },
  { model: Contact,       label: 'contacts' },
  { model: Counter,       label: 'counters' },
  { model: DocumentModel, label: 'documents' },
  { model: Invoice,       label: 'invoices' },
  { model: Lead,          label: 'leads' },
  { model: PipelineStage, label: 'pipelineStages' },
  { model: Settings,      label: 'settings' },
  { model: SmartList,     label: 'smartLists' },
  { model: TaskModel,     label: 'tasks' },
  { model: User,          label: 'users' },
] as const;
