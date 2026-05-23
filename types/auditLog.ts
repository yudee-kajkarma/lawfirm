import type { AuditAction, AuditSource } from '@/lib/constants/enums';

export type AuditChange = {
  path: string;
  before: unknown;
  after: unknown;
};

export type AuditLog = {
  _id: string;
  collectionName: string;
  documentId: string;
  action: AuditAction;
  actorId: string | null;
  actorEmail: string | null;
  source: AuditSource;
  ip: string | null;
  userAgent: string | null;
  businessUnit: string | null;
  changes: AuditChange[];
  createdAt: string;
};

export type AuditLogListMeta = {
  /** _id of the last item — pass back as `?cursor=` to fetch the next page. */
  cursor: string | null;
  limit: number;
};

export type AuditLogListFilters = {
  collectionName?: string;
  action?: AuditAction;
  source?: AuditSource;
  businessUnit?: string;
  actorEmail?: string;
  /** Inclusive ISO date string (YYYY-MM-DD or full ISO). */
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

// Collections we audit. Surfaced in the filter dropdown so admins don't have
// to remember exact strings. Keep in sync with `collectionName` values passed
// to `auditLogPlugin` in each model file.
export const AUDITED_COLLECTIONS = [
  'users',
  'businessUnits',
  'contacts',
  'leads',
  'cases',
  'tasks',
  'documents',
  'calendarEvents',
  'invoices',
  'smartLists',
  'caseChecklists',
  'pipelineStages',
  'settings',
] as const;
