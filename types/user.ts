export type User = {
  _id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  businessUnits: string[];
  isActive: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserListMeta = { page: number; limit: number; total: number };

export type UserListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: 'active' | 'inactive' | 'all';
  isAdmin?: boolean;
  businessUnit?: string;
  sort?: string;
};
