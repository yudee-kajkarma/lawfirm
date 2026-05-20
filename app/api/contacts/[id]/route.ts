import { isValidObjectId } from 'mongoose';

import { scopedQuery } from '@/lib/auth/scopedQuery';
import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { Contact, serializeContact } from '@/lib/models/Contact';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { contactUpdateSchema } from '@/lib/utils/validators/contact';

export const runtime = 'nodejs';

type Params = { id: string };

export const GET = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Contact not found', 404);
  }

  const contact = await Contact.findOne({ _id: params.id, ...scopedQuery(user) }).lean();
  if (!contact) return apiError('NOT_FOUND', 'Contact not found', 404);

  return apiOk({ data: serializeContact(contact as Record<string, unknown>) });
});

export const PATCH = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Contact not found', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = contactUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid contact data', 400, parsed.error.flatten());
  }

  if (
    parsed.data.businessUnit &&
    !user.isAdmin &&
    !user.businessUnits.includes(parsed.data.businessUnit)
  ) {
    return apiError('FORBIDDEN', 'No access to target business unit', 403);
  }

  // Fetch-then-save (NOT findOneAndUpdate) so audit-log + audit-fields hooks fire.
  const contact = await Contact.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!contact) return apiError('NOT_FOUND', 'Contact not found', 404);

  Object.assign(contact, parsed.data);
  await contact.save();

  return apiOk({ data: serializeContact(contact.toObject() as Record<string, unknown>) });
});

export const DELETE = withAuth<Params>(async (_req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Contact not found', 404);
  }

  const contact = await Contact.findOne({ _id: params.id, ...scopedQuery(user) });
  if (!contact) return apiError('NOT_FOUND', 'Contact not found', 404);

  await contact.softDelete();
  return apiOk({ data: { _id: params.id } });
});
