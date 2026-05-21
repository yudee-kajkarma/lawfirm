import type {
  SmartListEntity,
  SmartListOperator,
} from '@/lib/utils/smartListFields';

export type SmartListCondition = {
  field: string;
  operator: SmartListOperator;
  value: unknown;
};

export type SmartListFilterTree = {
  conjunction: 'and' | 'or';
  conditions: SmartListCondition[];
};

export type SmartList = {
  _id: string;
  name: string;
  description: string | null;
  entity: SmartListEntity;
  businessUnit: string;
  filterTree: SmartListFilterTree;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SmartListListFilters = {
  entity?: SmartListEntity;
  businessUnit?: string;
};
