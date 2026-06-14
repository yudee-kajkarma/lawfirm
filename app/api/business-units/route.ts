import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { BusinessUnit, serializeBusinessUnit } from '@/lib/models/BusinessUnit';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { parseListQuery } from '@/lib/utils/parseListQuery';
import { businessUnitCreateSchema } from '@/lib/utils/validators/businessUnit';

export const runtime = 'nodejs';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GET = withAuth(
  async (req, _ctx, { user }) => {
    await connectDb();
    const list = parseListQuery(req);
    const sp = req.nextUrl.searchParams;

    // Always start with the caller's tenant — no cross-tenant leakage possible.
    const filter: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    const isActive = sp.get('isActive');
    if (isActive === 'active') filter.isActive = true;
    else if (isActive === 'inactive') filter.isActive = false;

    if (list.search) {
      const re = new RegExp(escapeRegex(list.search), 'i');
      filter.$or = [{ key: re }, { name: re }, { description: re }];
    }

    const skip = (list.page - 1) * list.limit;
    // Default sort by order, then name, so the admin sees them in their
    // chosen rank instead of by creation date.
    const sort: Record<string, 1 | -1> =
      list.sort.field === 'createdAt'
        ? { order: 1, name: 1 }
        : { [list.sort.field]: list.sort.direction };

    const [items, total] = await Promise.all([
      BusinessUnit.find(filter).sort(sort).skip(skip).limit(list.limit).lean(),
      BusinessUnit.countDocuments(filter),
    ]);

    return apiOk({
      data: items.map((doc) => serializeBusinessUnit(doc as Record<string, unknown>)),
      meta: { page: list.page, limit: list.limit, total },
    });
  },
  { adminOnly: true },
);

export const POST = withAuth(
  async (req, _ctx, { user }) => {
    await connectDb();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
    }

    const parsed = businessUnitCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_ERROR',
        'Invalid business unit data',
        400,
        parsed.error.flatten(),
      );
    }

    // Catch dup key collisions cleanly. Scope to this tenant and include
    // soft-deleted records so a previously-removed key can't be silently
    // re-used and then cause confusion when the soft-deleted doc is restored.
    const existing = await BusinessUnit.findOne({
      tenantId: user.tenantId,
      key: parsed.data.key,
    }).setOptions({ withDeleted: true });
    if (existing) {
      return apiError('CONFLICT', 'A business unit with this key already exists', 409);
    }

    const created = await BusinessUnit.create({ ...parsed.data, tenantId: user.tenantId });
    return apiOk(
      { data: serializeBusinessUnit(created.toObject() as Record<string, unknown>) },
      201,
    );
  },
  { adminOnly: true },
);
