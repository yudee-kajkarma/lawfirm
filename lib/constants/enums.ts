// Single source of truth for enum-like values used by schemas and validators.
// Adding a new value: update the array, then run typecheck — every consumer
// (Zod validator, schema enum, TS type) will get the new option automatically.

export const DEFAULT_BUSINESS_UNITS = ['immigration', 'law', 'wealth'] as const;
export type DefaultBusinessUnitKey = (typeof DEFAULT_BUSINESS_UNITS)[number];

export const LEAD_STAGES = [
  'new_inquiry',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'converted',
  'lost',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
  'website',
  'referral',
  'social',
  'event',
  'cold_outreach',
  'other',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const CASE_STATUSES = ['open', 'in_progress', 'on_hold', 'closed'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const CONTACT_TYPES = ['client', 'prospect', 'witness', 'vendor', 'other'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const POLY_RELATED_TYPES = ['lead', 'case', 'contact'] as const;
export type PolyRelatedType = (typeof POLY_RELATED_TYPES)[number];

export const AUDIT_ACTIONS = ['create', 'update', 'delete', 'restore'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_SOURCES = ['user', 'system', 'webhook'] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export const MESSAGE_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
