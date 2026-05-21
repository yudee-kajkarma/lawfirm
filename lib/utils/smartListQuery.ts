import { Types } from 'mongoose';

import { ValidationError } from './errors';
import { isValidObjectIdString } from './objectId';
import {
  RELATIVE_DATE_PRESETS,
  SMART_LIST_OPERATORS,
  getFieldSpec,
  type RelativeDatePreset,
  type SmartListEntity,
  type SmartListFieldSpec,
  type SmartListOperator,
} from './smartListFields';

export type FilterCondition = {
  field: string;
  operator: SmartListOperator;
  value: unknown;
};

export type FilterTree = {
  conjunction: 'and' | 'or';
  conditions: FilterCondition[];
};

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date): Date {
  const quarter = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), quarter * 3, 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** Resolves a preset to a `{ $gte, $lte }`-shaped range relative to `now`. */
export function relativePresetToRange(
  preset: RelativeDatePreset,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const today = startOfDay(now);
  switch (preset) {
    case 'today':
      return { start: today, end: addDays(today, 1) };
    case 'yesterday':
      return { start: addDays(today, -1), end: today };
    case 'last7days':
      return { start: addDays(today, -7), end: now };
    case 'last30days':
      return { start: addDays(today, -30), end: now };
    case 'last90days':
      return { start: addDays(today, -90), end: now };
    case 'thisMonth':
      return { start: startOfMonth(now), end: now };
    case 'thisQuarter':
      return { start: startOfQuarter(now), end: now };
    case 'thisYear':
      return { start: startOfYear(now), end: now };
  }
}

function coerceScalar(value: unknown, type: SmartListFieldSpec['type']): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'string':
    case 'enum':
      if (typeof value !== 'string') {
        throw new ValidationError(`Expected string for ${type} field`);
      }
      return value;
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return Number(value);
      }
      throw new ValidationError(`Expected number for number field`);
    case 'date': {
      if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
      if (typeof value === 'string') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d;
      }
      throw new ValidationError(`Expected ISO date string or Date for date field`);
    }
    case 'objectId':
      if (typeof value !== 'string' || !isValidObjectIdString(value)) {
        throw new ValidationError(`Expected ObjectId string for ${type} field`);
      }
      return new Types.ObjectId(value);
  }
}

function coerceEnumMember(value: unknown, spec: SmartListFieldSpec): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`Enum value must be a string`);
  }
  if (spec.enumValues && !spec.enumValues.includes(value)) {
    throw new ValidationError(`Value "${value}" is not allowed for ${spec.field}`);
  }
  return value;
}

function translateCondition(
  spec: SmartListFieldSpec,
  cond: FilterCondition,
): Record<string, unknown> {
  const { field, type } = spec;
  const op = cond.operator;
  const raw = cond.value;

  switch (op) {
    case 'equals': {
      if (type === 'enum') return { [field]: coerceEnumMember(raw, spec) };
      return { [field]: coerceScalar(raw, type) };
    }
    case 'notEquals': {
      const v = type === 'enum' ? coerceEnumMember(raw, spec) : coerceScalar(raw, type);
      return { [field]: { $ne: v } };
    }
    case 'contains': {
      if (typeof raw !== 'string' || raw.length === 0) {
        throw new ValidationError('contains requires a non-empty string');
      }
      return { [field]: { $regex: escapeRegex(raw), $options: 'i' } };
    }
    case 'startsWith': {
      if (typeof raw !== 'string' || raw.length === 0) {
        throw new ValidationError('startsWith requires a non-empty string');
      }
      return { [field]: { $regex: `^${escapeRegex(raw)}`, $options: 'i' } };
    }
    case 'in':
    case 'notIn': {
      if (!Array.isArray(raw) || raw.length === 0) {
        throw new ValidationError(`${op} requires a non-empty array`);
      }
      const arr = raw.map((v) => (type === 'enum' ? coerceEnumMember(v, spec) : coerceScalar(v, type)));
      return { [field]: op === 'in' ? { $in: arr } : { $nin: arr } };
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const v = coerceScalar(raw, type);
      const mongoOp = `$${op}`;
      return { [field]: { [mongoOp]: v } };
    }
    case 'before':
      return { [field]: { $lt: coerceScalar(raw, 'date') } };
    case 'after':
      return { [field]: { $gt: coerceScalar(raw, 'date') } };
    case 'between': {
      if (!Array.isArray(raw) || raw.length !== 2) {
        throw new ValidationError('between requires a [from, to] tuple');
      }
      const from = coerceScalar(raw[0], type);
      const to = coerceScalar(raw[1], type);
      return { [field]: { $gte: from, $lte: to } };
    }
    case 'relative': {
      if (typeof raw !== 'string' || !(RELATIVE_DATE_PRESETS as readonly string[]).includes(raw)) {
        throw new ValidationError(`relative requires one of: ${RELATIVE_DATE_PRESETS.join(', ')}`);
      }
      const { start, end } = relativePresetToRange(raw as RelativeDatePreset);
      return { [field]: { $gte: start, $lte: end } };
    }
    case 'isEmpty':
      return { [field]: null };
    case 'isNotEmpty':
      return { [field]: { $ne: null } };
  }
}

/**
 * Translates a Smart List filter tree into a Mongoose filter object for the
 * given entity. Validates every condition against the per-entity whitelist —
 * unknown fields or disallowed operators throw `ValidationError`.
 */
export function translateFilterTree(
  tree: FilterTree,
  entity: SmartListEntity,
): Record<string, unknown> {
  if (!tree || !Array.isArray(tree.conditions)) {
    throw new ValidationError('Filter tree must include a conditions array');
  }
  if (tree.conjunction !== 'and' && tree.conjunction !== 'or') {
    throw new ValidationError('Filter tree conjunction must be "and" or "or"');
  }

  const clauses: Record<string, unknown>[] = [];
  for (const cond of tree.conditions) {
    if (!(SMART_LIST_OPERATORS as readonly string[]).includes(cond.operator)) {
      throw new ValidationError(`Unknown operator: ${cond.operator}`);
    }
    const spec = getFieldSpec(entity, cond.field);
    if (!spec) {
      throw new ValidationError(`Field "${cond.field}" is not filterable on ${entity}`);
    }
    if (!spec.operators.includes(cond.operator)) {
      throw new ValidationError(`Operator "${cond.operator}" is not allowed on ${entity}.${cond.field}`);
    }
    clauses.push(translateCondition(spec, cond));
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0]!;
  return tree.conjunction === 'or' ? { $or: clauses } : { $and: clauses };
}
