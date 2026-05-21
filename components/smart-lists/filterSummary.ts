import {
  RELATIVE_DATE_PRESETS,
  getFieldSpec,
  type RelativeDatePreset,
  type SmartListEntity,
  type SmartListOperator,
} from '@/lib/utils/smartListFields';
import type { SmartListCondition, SmartListFilterTree } from '@/types/smartList';

const OPERATOR_LABELS: Record<SmartListOperator, string> = {
  equals: 'is',
  notEquals: 'is not',
  contains: 'contains',
  startsWith: 'starts with',
  in: 'is one of',
  notIn: 'is not one of',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: 'between',
  before: 'before',
  after: 'after',
  relative: 'in',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

const RELATIVE_LABELS: Record<RelativeDatePreset, string> = {
  today: 'today',
  yesterday: 'yesterday',
  last7days: 'the last 7 days',
  last30days: 'the last 30 days',
  last90days: 'the last 90 days',
  thisMonth: 'this month',
  thisQuarter: 'this quarter',
  thisYear: 'this year',
};

function formatValue(operator: SmartListOperator, value: unknown): string {
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return '';
  if (operator === 'in' || operator === 'notIn') {
    if (!Array.isArray(value)) return '?';
    return `[${value.join(', ')}]`;
  }
  if (operator === 'between') {
    if (!Array.isArray(value) || value.length !== 2) return '?';
    return `${value[0]} – ${value[1]}`;
  }
  if (operator === 'relative') {
    if (typeof value === 'string' && (RELATIVE_DATE_PRESETS as readonly string[]).includes(value)) {
      return RELATIVE_LABELS[value as RelativeDatePreset];
    }
    return '?';
  }
  if (value === null || value === undefined || value === '') return '?';
  return String(value);
}

function summarizeCondition(entity: SmartListEntity, c: SmartListCondition): string {
  const spec = getFieldSpec(entity, c.field);
  const fieldLabel = spec?.label ?? c.field;
  const opLabel = OPERATOR_LABELS[c.operator] ?? c.operator;
  const valueStr = formatValue(c.operator, c.value);
  return valueStr ? `${fieldLabel} ${opLabel} ${valueStr}` : `${fieldLabel} ${opLabel}`;
}

/** "Stage is one of [qualified, proposal] AND Value > 10000" */
export function summarizeFilterTree(
  tree: SmartListFilterTree | null | undefined,
  entity: SmartListEntity,
): string {
  if (!tree || tree.conditions.length === 0) return 'No conditions';
  const parts = tree.conditions.map((c) => summarizeCondition(entity, c));
  const joiner = tree.conjunction === 'and' ? ' AND ' : ' OR ';
  return parts.join(joiner);
}
