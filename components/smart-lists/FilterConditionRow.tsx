'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RELATIVE_DATE_PRESETS,
  SMART_LIST_FIELDS,
  getFieldSpec,
  type RelativeDatePreset,
  type SmartListEntity,
  type SmartListFieldSpec,
  type SmartListOperator,
} from '@/lib/utils/smartListFields';
import { cn } from '@/lib/utils';
import type { SmartListCondition } from '@/types/smartList';

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
  relative: 'in the…',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

const RELATIVE_LABELS: Record<RelativeDatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 days',
  last30days: 'Last 30 days',
  last90days: 'Last 90 days',
  thisMonth: 'This month',
  thisQuarter: 'This quarter',
  thisYear: 'This year',
};

type Props = {
  entity: SmartListEntity;
  condition: SmartListCondition;
  onChange: (next: SmartListCondition) => void;
  onRemove: () => void;
};

/**
 * Sensible default value for a (field, operator) combination — used when
 * either changes so the editor never lands in an "empty value of the wrong
 * type" state that would fail validation on save.
 */
function defaultValueFor(spec: SmartListFieldSpec, op: SmartListOperator): unknown {
  if (op === 'isEmpty' || op === 'isNotEmpty') return null;
  if (op === 'in' || op === 'notIn') return [];
  if (op === 'between') return ['', ''];
  if (op === 'relative') return 'today';
  if (spec.type === 'enum') return spec.enumValues?.[0] ?? '';
  return '';
}

function pickFirstAllowedOperator(spec: SmartListFieldSpec): SmartListOperator {
  return spec.operators[0]!;
}

export function FilterConditionRow({ entity, condition, onChange, onRemove }: Props) {
  const fields = SMART_LIST_FIELDS[entity];
  const spec = getFieldSpec(entity, condition.field);

  function setField(field: string) {
    const next = getFieldSpec(entity, field);
    if (!next) return;
    // If the current operator isn't valid on the new field, pick its first allowed.
    const op = next.operators.includes(condition.operator)
      ? condition.operator
      : pickFirstAllowedOperator(next);
    onChange({
      field,
      operator: op,
      value: defaultValueFor(next, op),
    });
  }

  function setOperator(op: SmartListOperator) {
    if (!spec) return;
    onChange({
      field: condition.field,
      operator: op,
      value: defaultValueFor(spec, op),
    });
  }

  function setValue(value: unknown) {
    onChange({ ...condition, value });
  }

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-md border border-border bg-card p-2">
      <Select value={condition.field} onValueChange={setField}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.field} value={f.field}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={condition.operator} onValueChange={(v) => setOperator(v as SmartListOperator)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(spec?.operators ?? []).map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {spec && (
        <div className="min-w-[180px] flex-1">
          <ValueInput spec={spec} operator={condition.operator} value={condition.value} onChange={setValue} />
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={onRemove}
        aria-label="Remove condition"
      >
        <Trash2 className="size-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

function ValueInput({
  spec,
  operator,
  value,
  onChange,
}: {
  spec: SmartListFieldSpec;
  operator: SmartListOperator;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (operator === 'isEmpty' || operator === 'isNotEmpty') {
    return <span className="text-xs text-muted-foreground">(no value needed)</span>;
  }

  if (operator === 'relative') {
    const v = typeof value === 'string' ? value : 'today';
    return (
      <Select value={v} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RELATIVE_DATE_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {RELATIVE_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (operator === 'in' || operator === 'notIn') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const options = spec.enumValues ?? [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isOn = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const next = isOn ? selected.filter((s) => s !== opt) : [...selected, opt];
                onChange(next);
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                isOn
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (operator === 'between') {
    const [from, to] = Array.isArray(value) ? value : ['', ''];
    const inputType = spec.type === 'date' ? 'date' : 'number';
    return (
      <div className="flex items-center gap-2">
        <Input
          type={inputType}
          value={typeof from === 'string' || typeof from === 'number' ? String(from) : ''}
          onChange={(e) => onChange([e.target.value, to])}
          className="w-full"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type={inputType}
          value={typeof to === 'string' || typeof to === 'number' ? String(to) : ''}
          onChange={(e) => onChange([from, e.target.value])}
          className="w-full"
        />
      </div>
    );
  }

  if (spec.type === 'enum' && (operator === 'equals' || operator === 'notEquals')) {
    const v = typeof value === 'string' ? value : '';
    return (
      <Select value={v} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pick a value" />
        </SelectTrigger>
        <SelectContent>
          {(spec.enumValues ?? []).map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (spec.type === 'date') {
    const v = typeof value === 'string' ? value : '';
    return (
      <Input
        type="date"
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
    );
  }

  if (spec.type === 'number') {
    const v = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    return (
      <Input
        type="number"
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
    );
  }

  // string and objectId both render as plain text inputs.
  const v = typeof value === 'string' ? value : '';
  return (
    <Input
      type="text"
      value={v}
      onChange={(e) => onChange(e.target.value)}
      placeholder={spec.type === 'objectId' ? 'ObjectId string' : ''}
      className="w-full"
    />
  );
}
