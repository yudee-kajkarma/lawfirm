'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SMART_LIST_FIELDS,
  type SmartListEntity,
} from '@/lib/utils/smartListFields';
import type { SmartListCondition, SmartListFilterTree } from '@/types/smartList';

import { FilterConditionRow } from './FilterConditionRow';

type Props = {
  entity: SmartListEntity;
  tree: SmartListFilterTree;
  onChange: (next: SmartListFilterTree) => void;
};

function makeBlankCondition(entity: SmartListEntity): SmartListCondition {
  const firstField = SMART_LIST_FIELDS[entity][0]!;
  const firstOp = firstField.operators[0]!;
  return {
    field: firstField.field,
    operator: firstOp,
    // Empty string is a sensible "user hasn't typed yet" default for the
    // common string/number/date case. Other types adjust via FilterConditionRow.
    value: '',
  };
}

export function FilterBuilder({ entity, tree, onChange }: Props) {
  function setConjunction(value: 'and' | 'or') {
    onChange({ ...tree, conjunction: value });
  }

  function updateCondition(index: number, next: SmartListCondition) {
    const nextConds = tree.conditions.slice();
    nextConds[index] = next;
    onChange({ ...tree, conditions: nextConds });
  }

  function removeCondition(index: number) {
    onChange({
      ...tree,
      conditions: tree.conditions.filter((_, i) => i !== index),
    });
  }

  function addCondition() {
    onChange({
      ...tree,
      conditions: [...tree.conditions, makeBlankCondition(entity)],
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Match</span>
        <Select value={tree.conjunction} onValueChange={(v) => setConjunction(v as 'and' | 'or')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">All conditions (AND)</SelectItem>
            <SelectItem value="or">Any condition (OR)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tree.conditions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card/30 px-3 py-6 text-center text-xs text-muted-foreground">
          No conditions yet. A smart list with no conditions matches everything in this BU.
        </p>
      ) : (
        <div className="space-y-2">
          {tree.conditions.map((cond, i) => (
            <FilterConditionRow
              key={i}
              entity={entity}
              condition={cond}
              onChange={(next) => updateCondition(i, next)}
              onRemove={() => removeCondition(i)}
            />
          ))}
        </div>
      )}

      {/* `type="button"` is critical — without it, this <button> defaults to
          type="submit" inside the enclosing <form> and clicking "Add condition"
          would submit the half-filled form. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={addCondition}
      >
        <Plus className="size-3.5" />
        Add condition
      </Button>
    </div>
  );
}
