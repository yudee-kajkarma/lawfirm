import type { CaseStatus } from '@/lib/constants/enums';

export type Case = {
  _id: string;
  caseNumber: string;
  title: string;
  description: string | null;
  caseType: string | null;
  status: CaseStatus;
  businessUnit: string;
  clientId: string;
  assignedTo: string | null;
  openedAt: string | null;
  closedAt: string | null;
  value: number | null;
  convertedFromLead: string | null;
  tags: string[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CaseListMeta = { page: number; limit: number; total: number };

export type CaseListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  status?: CaseStatus;
  assignedTo?: string;
  clientId?: string;
  businessUnit?: string;
  sort?: string;
};
