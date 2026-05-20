import type { NextRequest } from 'next/server';

export type ListQuery = {
  page: number;
  limit: number;
  sort: { field: string; direction: 1 | -1 };
  businessUnit: string | null;
  assignedTo: string | null;
  search: string | null;
  smartListId: string | null;
  includeDeleted: boolean;
  cursor: string | null;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function parseListQuery(req: NextRequest): ListQuery {
  const sp = req.nextUrl.searchParams;

  const page = Math.max(1, Number(sp.get('page')) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || DEFAULT_LIMIT));

  const sortRaw = sp.get('sort') ?? 'createdAt:desc';
  const parts = sortRaw.split(':');
  const field = parts[0] && parts[0].length > 0 ? parts[0] : 'createdAt';
  const dirRaw = parts[1] ?? 'desc';
  const direction: 1 | -1 = dirRaw === 'asc' ? 1 : -1;

  return {
    page,
    limit,
    sort: { field, direction },
    businessUnit: sp.get('businessUnit'),
    assignedTo: sp.get('assignedTo'),
    search: sp.get('search'),
    smartListId: sp.get('smartListId'),
    includeDeleted: sp.get('includeDeleted') === 'true',
    cursor: sp.get('cursor'),
  };
}
