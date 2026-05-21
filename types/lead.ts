import type { LeadSource, LeadStage } from '@/lib/constants/enums';

export type Lead = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  stage: LeadStage;
  businessUnit: string;
  assignedTo: string | null;
  companyName: string | null;
  jobTitle: string | null;
  value: number | null;
  expectedCloseDate: string | null;
  notes: string | null;
  tags: string[];
  convertedToCase: string | null;
  convertedAt: string | null;
  linkedContact: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadListMeta = { page: number; limit: number; total: number };

export type LeadListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  stage?: LeadStage;
  source?: LeadSource;
  assignedTo?: string;
  businessUnit?: string;
  smartListId?: string;
  sort?: string;
};
