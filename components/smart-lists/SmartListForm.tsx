'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useBusinessUnit } from '@/hooks/useBusinessUnit';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { SMART_LIST_ENTITIES, type SmartListEntity } from '@/lib/utils/smartListFields';
import type {
  SmartListCreateInput,
  SmartListUpdateInput,
} from '@/lib/utils/validators/smartList';
import type { SmartListFilterTree } from '@/types/smartList';

import { FilterBuilder } from './FilterBuilder';

const ENTITY_LABELS: Record<SmartListEntity, string> = {
  lead: 'Leads',
  case: 'Cases',
  contact: 'Contacts',
  task: 'Tasks',
};

type CreateProps = {
  mode: 'create';
  defaultValues?: Partial<{
    name: string;
    description: string;
    entity: SmartListEntity;
    businessUnit: string;
    filterTree: SmartListFilterTree;
  }>;
  onSubmit: (input: SmartListCreateInput) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
};

type EditProps = {
  mode: 'edit';
  defaultValues: {
    name: string;
    description: string | null;
    entity: SmartListEntity;
    businessUnit: string;
    filterTree: SmartListFilterTree;
  };
  onSubmit: (input: SmartListUpdateInput) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
};

type Props = CreateProps | EditProps;

export function SmartListForm(props: Props) {
  const { businessUnits, currentBU } = useBusinessUnit();
  const { isAdmin } = useCurrentUser();

  const isEdit = props.mode === 'edit';

  const initialEntity: SmartListEntity =
    props.defaultValues?.entity ?? 'lead';
  const initialBU =
    props.defaultValues?.businessUnit ??
    (currentBU !== 'all' ? currentBU : businessUnits.length === 1 ? businessUnits[0]!.key : '');

  const [name, setName] = useState(props.defaultValues?.name ?? '');
  const [description, setDescription] = useState(
    (props.defaultValues?.description as string | null | undefined) ?? '',
  );
  const [entity, setEntity] = useState<SmartListEntity>(initialEntity);
  const [businessUnit, setBusinessUnit] = useState<string>(initialBU);
  const [tree, setTree] = useState<SmartListFilterTree>(
    props.defaultValues?.filterTree ?? { conjunction: 'and', conditions: [] },
  );
  const [error, setError] = useState<string | null>(null);

  const buLocked = isEdit || (!isAdmin && businessUnits.length === 1);

  function onEntityChange(next: SmartListEntity) {
    // Resetting conditions when entity flips — different field whitelist,
    // existing conditions would mostly be invalid.
    setEntity(next);
    setTree({ conjunction: 'and', conditions: [] });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!businessUnit) {
      setError('Business unit is required');
      return;
    }
    if (tree.conditions.length === 0) {
      setError('Add at least one condition');
      return;
    }

    if (isEdit) {
      await props.onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        filterTree: tree,
      } as SmartListUpdateInput);
    } else {
      await props.onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        entity,
        businessUnit,
        filterTree: tree,
      } as SmartListCreateInput);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Name<span className="ml-0.5 text-destructive">*</span>
        </Label>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hot deals in Law"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Entity<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Select
            value={entity}
            onValueChange={(v) => onEntityChange(v as SmartListEntity)}
            disabled={isEdit}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SMART_LIST_ENTITIES.map((e) => (
                <SelectItem key={e} value={e}>
                  {ENTITY_LABELS[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isEdit && (
            <p className="text-[10px] text-muted-foreground">
              Entity is fixed once a smart list is created.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Business unit<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Select value={businessUnit} onValueChange={setBusinessUnit} disabled={buLocked}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a business unit" />
            </SelectTrigger>
            <SelectContent>
              {businessUnits.map((bu) => (
                <SelectItem key={bu.key} value={bu.key}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: bu.color }}
                    />
                    {bu.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Description</Label>
        <Textarea
          rows={2}
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this smart list surfaces and when to use it."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Filter conditions</Label>
        <FilterBuilder entity={entity} tree={tree} onChange={setTree} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {props.onCancel && (
          <Button type="button" variant="ghost" onClick={props.onCancel} disabled={props.isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={props.isSubmitting}>
          {props.isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create smart list'}
        </Button>
      </div>
    </form>
  );
}
