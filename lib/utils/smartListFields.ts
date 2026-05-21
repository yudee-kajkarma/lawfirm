import {
  CASE_STATUSES,
  CONTACT_TYPES,
  LEAD_SOURCES,
  LEAD_STAGES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@/lib/constants/enums';

/**
 * Whitelist of fields each entity can be filtered on via Smart Lists.
 * The translator validates every condition against this catalog — anything
 * not listed here is rejected. Adding a new filterable field = one entry.
 *
 * `relativePresets` (date type) is intentionally a fixed set rather than
 * an arbitrary "last N days" — keeps the builder UI simple and the query
 * parameters easy to validate.
 */

export const SMART_LIST_ENTITIES = ['lead', 'case', 'contact', 'task'] as const;
export type SmartListEntity = (typeof SMART_LIST_ENTITIES)[number];

export type SmartListFieldType = 'string' | 'enum' | 'number' | 'date' | 'objectId';

export const SMART_LIST_OPERATORS = [
  'equals',
  'notEquals',
  'contains',
  'startsWith',
  'in',
  'notIn',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'before',
  'after',
  'relative',
  'isEmpty',
  'isNotEmpty',
] as const;
export type SmartListOperator = (typeof SMART_LIST_OPERATORS)[number];

export const RELATIVE_DATE_PRESETS = [
  'today',
  'yesterday',
  'last7days',
  'last30days',
  'last90days',
  'thisMonth',
  'thisQuarter',
  'thisYear',
] as const;
export type RelativeDatePreset = (typeof RELATIVE_DATE_PRESETS)[number];

export type SmartListFieldSpec = {
  field: string;
  label: string;
  type: SmartListFieldType;
  operators: readonly SmartListOperator[];
  enumValues?: readonly string[];
};

const STRING_OPS = ['contains', 'startsWith', 'equals', 'notEquals', 'isEmpty', 'isNotEmpty'] as const;
const ENUM_OPS = ['equals', 'notEquals', 'in', 'notIn'] as const;
const NUMBER_OPS = ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'between', 'isEmpty', 'isNotEmpty'] as const;
const DATE_OPS = ['before', 'after', 'between', 'relative', 'isEmpty', 'isNotEmpty'] as const;
const OBJECT_ID_OPS = ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'] as const;

const LEAD_FIELDS: SmartListFieldSpec[] = [
  { field: 'firstName', label: 'First name', type: 'string', operators: STRING_OPS },
  { field: 'lastName', label: 'Last name', type: 'string', operators: STRING_OPS },
  { field: 'email', label: 'Email', type: 'string', operators: STRING_OPS },
  { field: 'phone', label: 'Phone', type: 'string', operators: STRING_OPS },
  { field: 'stage', label: 'Stage', type: 'enum', operators: ENUM_OPS, enumValues: LEAD_STAGES },
  { field: 'source', label: 'Source', type: 'enum', operators: ENUM_OPS, enumValues: LEAD_SOURCES },
  { field: 'companyName', label: 'Company', type: 'string', operators: STRING_OPS },
  { field: 'jobTitle', label: 'Job title', type: 'string', operators: STRING_OPS },
  { field: 'value', label: 'Value', type: 'number', operators: NUMBER_OPS },
  { field: 'expectedCloseDate', label: 'Expected close', type: 'date', operators: DATE_OPS },
  { field: 'assignedTo', label: 'Assigned to', type: 'objectId', operators: OBJECT_ID_OPS },
  { field: 'createdAt', label: 'Created', type: 'date', operators: DATE_OPS },
  { field: 'updatedAt', label: 'Updated', type: 'date', operators: DATE_OPS },
];

const CASE_FIELDS: SmartListFieldSpec[] = [
  { field: 'caseNumber', label: 'Case number', type: 'string', operators: STRING_OPS },
  { field: 'title', label: 'Title', type: 'string', operators: STRING_OPS },
  { field: 'caseType', label: 'Case type', type: 'string', operators: STRING_OPS },
  { field: 'status', label: 'Status', type: 'enum', operators: ENUM_OPS, enumValues: CASE_STATUSES },
  { field: 'value', label: 'Value', type: 'number', operators: NUMBER_OPS },
  { field: 'clientId', label: 'Client', type: 'objectId', operators: OBJECT_ID_OPS },
  { field: 'assignedTo', label: 'Assigned to', type: 'objectId', operators: OBJECT_ID_OPS },
  { field: 'openedAt', label: 'Opened', type: 'date', operators: DATE_OPS },
  { field: 'closedAt', label: 'Closed', type: 'date', operators: DATE_OPS },
  { field: 'createdAt', label: 'Created', type: 'date', operators: DATE_OPS },
  { field: 'updatedAt', label: 'Updated', type: 'date', operators: DATE_OPS },
];

const CONTACT_FIELDS: SmartListFieldSpec[] = [
  { field: 'firstName', label: 'First name', type: 'string', operators: STRING_OPS },
  { field: 'lastName', label: 'Last name', type: 'string', operators: STRING_OPS },
  { field: 'email', label: 'Email', type: 'string', operators: STRING_OPS },
  { field: 'phone', label: 'Phone', type: 'string', operators: STRING_OPS },
  { field: 'contactType', label: 'Type', type: 'enum', operators: ENUM_OPS, enumValues: CONTACT_TYPES },
  { field: 'companyName', label: 'Company', type: 'string', operators: STRING_OPS },
  { field: 'jobTitle', label: 'Job title', type: 'string', operators: STRING_OPS },
  { field: 'createdAt', label: 'Created', type: 'date', operators: DATE_OPS },
  { field: 'updatedAt', label: 'Updated', type: 'date', operators: DATE_OPS },
];

const TASK_FIELDS: SmartListFieldSpec[] = [
  { field: 'title', label: 'Title', type: 'string', operators: STRING_OPS },
  { field: 'status', label: 'Status', type: 'enum', operators: ENUM_OPS, enumValues: TASK_STATUSES },
  { field: 'priority', label: 'Priority', type: 'enum', operators: ENUM_OPS, enumValues: TASK_PRIORITIES },
  { field: 'assignedTo', label: 'Assigned to', type: 'objectId', operators: OBJECT_ID_OPS },
  { field: 'dueDate', label: 'Due date', type: 'date', operators: DATE_OPS },
  { field: 'completedAt', label: 'Completed', type: 'date', operators: DATE_OPS },
  { field: 'createdAt', label: 'Created', type: 'date', operators: DATE_OPS },
  { field: 'updatedAt', label: 'Updated', type: 'date', operators: DATE_OPS },
];

export const SMART_LIST_FIELDS: Record<SmartListEntity, readonly SmartListFieldSpec[]> = {
  lead: LEAD_FIELDS,
  case: CASE_FIELDS,
  contact: CONTACT_FIELDS,
  task: TASK_FIELDS,
};

export function getFieldSpec(entity: SmartListEntity, field: string): SmartListFieldSpec | undefined {
  return SMART_LIST_FIELDS[entity].find((f) => f.field === field);
}
