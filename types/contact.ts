import type { ContactType } from '@/lib/constants/enums';

export type ContactAddress = {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export type Contact = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  contactType: ContactType;
  businessUnit: string;
  companyName: string | null;
  jobTitle: string | null;
  address: ContactAddress | null;
  tags: string[];
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactListMeta = { page: number; limit: number; total: number };

export type ContactListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  contactType?: ContactType;
  businessUnit?: string;
  smartListId?: string;
  sort?: string;
};
