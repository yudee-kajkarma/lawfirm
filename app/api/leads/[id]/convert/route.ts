import { isValidObjectId } from 'mongoose';

import { withAuth } from '@/lib/auth/withAuth';
import { connectDb } from '@/lib/db/connect';
import { serializeCase } from '@/lib/models/Case';
import { serializeContact } from '@/lib/models/Contact';
import { serializeLead } from '@/lib/models/Lead';
import { convertLead } from '@/lib/services/leadConversion';
import { apiError, apiOk } from '@/lib/utils/apiResponse';
import { AppError } from '@/lib/utils/errors';
import { convertLeadSchema } from '@/lib/utils/validators/case';

export const runtime = 'nodejs';

type Params = { id: string };

export const POST = withAuth<Params>(async (req, { params }, { user }) => {
  await connectDb();
  if (!isValidObjectId(params.id)) {
    return apiError('NOT_FOUND', 'Lead not found', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be JSON', 400);
  }

  const parsed = convertLeadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid conversion data', 400, parsed.error.flatten());
  }

  try {
    const result = await convertLead({
      user,
      leadId: params.id,
      caseTitle: parsed.data.caseTitle,
      caseType: parsed.data.caseType ?? null,
      caseDescription: parsed.data.caseDescription ?? null,
      caseValue: parsed.data.caseValue ?? null,
      caseTags: parsed.data.caseTags ?? [],
      assignedTo: parsed.data.assignedTo ?? null,
      existingContactId: parsed.data.existingContactId ?? null,
    });
    return apiOk(
      {
        data: {
          lead: serializeLead(result.lead.toObject() as Record<string, unknown>),
          contact: serializeContact(result.contact.toObject() as Record<string, unknown>),
          case: serializeCase(result.case.toObject() as Record<string, unknown>),
        },
      },
      201,
    );
  } catch (e) {
    if (e instanceof AppError) {
      return apiError(e.code, e.message, e.statusCode);
    }
    throw e;
  }
});
