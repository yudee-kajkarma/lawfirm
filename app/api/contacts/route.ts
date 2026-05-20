import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Contact, serializeContact } from '@/lib/models/Contact';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { parseListQuery } from '@/lib/utils/parseListQuery';
import { contactCreateSchema } from '@/lib/utils/validators/contact';

export const runtime = 'nodejs';

// Regex meta-chars we need to escape before stuffing user input into a RegExp.
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const GET = withAuth(async (req, _ctx, { user }) => {
  await connectDb();
  const list = parseListQuery(req);
  const sp = req.nextUrl.searchParams;

  const filter: Record<string, unknown> = { ...scopedQuery(user, list.businessUnit) };

  const contactType = sp.get('contactType');
  if (contactType) filter.contactType = contactType;

  if (list.search) {
    const re = new RegExp(escapeRegex(list.search), 'i');
    filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { companyName: re }];
  }

  const skip = (list.page - 1) * list.limit;
  const sort: Record<string, 1 | -1> = { [list.sort.field]: list.sort.direction };

  const [items, total] = await Promise.all([
    Contact.find(filter).sort(sort).skip(skip).limit(list.limit).lean(),
    Contact.countDocuments(filter),
  ]);

  return apiOk({
    data: items.map((doc) => serializeContact(doc as Record<string, unknown>)),
    meta: { page: list.page, limit: list.limit, total },
  });
});

export const POST = withAuth(async (req, _ctx, { user }) => {
  await connectDb();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = contactCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid contact data', 400, parsed.error.flatten());
  }

  if (!user.isAdmin && !user.businessUnits.includes(parsed.data.businessUnit)) {
    return apiError('FORBIDDEN', 'No access to this business unit', 403);
  }

  const created = await Contact.create(parsed.data);
  // Belt-and-suspenders — if id somehow comes back malformed, fail loud.
  if (!isValidObjectId(created._id)) {
    return apiError('INTERNAL_ERROR', 'Created contact has invalid id', 500);
  }

  return apiOk(
    { data: serializeContact(created.toObject() as Record<string, unknown>) },
    201,
  );
});
