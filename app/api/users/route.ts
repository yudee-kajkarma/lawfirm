import { hashPassword } from '@/lib/auth/password';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { User, serializeUser } from '@/lib/models/User';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { parseListQuery } from '@/lib/utils/parseListQuery';
import { userCreateSchema } from '@/lib/utils/validators/user';

export const runtime = 'nodejs';

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GET = withAuth(
  async (req) => {
    await connectDb();
    const list = parseListQuery(req);
    const sp = req.nextUrl.searchParams;

    const filter: Record<string, unknown> = {};

    const isActive = sp.get('isActive');
    if (isActive === 'active') filter.isActive = true;
    else if (isActive === 'inactive') filter.isActive = false;

    const isAdmin = sp.get('isAdmin');
    if (isAdmin === 'true') filter.isAdmin = true;
    else if (isAdmin === 'false') filter.isAdmin = false;

    const businessUnit = sp.get('businessUnit');
    if (businessUnit) filter.businessUnits = businessUnit;

    if (list.search) {
      const re = new RegExp(escapeRegex(list.search), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }

    const skip = (list.page - 1) * list.limit;
    const sort: Record<string, 1 | -1> = { [list.sort.field]: list.sort.direction };

    const [items, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(list.limit).lean(),
      User.countDocuments(filter),
    ]);

    return apiOk({
      data: items.map((doc) => serializeUser(doc as Record<string, unknown>)),
      meta: { page: list.page, limit: list.limit, total },
    });
  },
  { adminOnly: true },
);

export const POST = withAuth(
  async (req) => {
    await connectDb();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
    }

    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid user data', 400, parsed.error.flatten());
    }

    const existing = await User.findOne({ email: parsed.data.email }).setOptions({
      withDeleted: true,
    });
    if (existing) {
      return apiError('CONFLICT', 'A user with this email already exists', 409);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const created = await User.create({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      isAdmin: parsed.data.isAdmin,
      businessUnits: parsed.data.businessUnits,
      isActive: parsed.data.isActive,
    });

    return apiOk(
      { data: serializeUser(created.toObject() as Record<string, unknown>) },
      201,
    );
  },
  { adminOnly: true },
);
