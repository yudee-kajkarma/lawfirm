export type BusinessUnit = {
  _id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BusinessUnitListMeta = { page: number; limit: number; total: number };

export type BusinessUnitListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: 'active' | 'inactive' | 'all';
  sort?: string;
};
