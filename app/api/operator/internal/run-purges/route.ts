import { createHmac, timingSafeEqual } from 'node:crypto';

import type { NextRequest } from 'next/server';

import { connectDb } from '@/lib/db/connect';
import { Tenant } from '@/lib/models/Tenant';
import {
  PurgeIneligible,
  PurgeIncomplete,
  purgeTenant,
} from '@/lib/services/purgeTenant';
import { apiError, apiOk } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

const CRON_SECRET = process.env.PURGE_CRON_SECRET;

export async function POST(req: NextRequest): Promise<Response> {
  if (!CRON_SECRET) {
    return apiError('SERVER_CONFIG', 'PURGE_CRON_SECRET not set', 500);
  }
  const body = await req.text();
  const expected = createHmac('sha256', CRON_SECRET).update(body).digest('hex');
  const provided = req.headers.get('x-purge-cron-signature') ?? '';
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided.length === a.length * 2 ? provided : '', 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return apiError('UNAUTHORIZED', 'Invalid cron signature', 401);
  }

  await connectDb();

  const now = new Date();
  const eligible = await Tenant.find({
    $or: [
      { status: 'pending_purge', purgeScheduledAt: { $lte: now } },
      { status: 'purging' },
    ],
  }).select('_id slug').lean();

  const results: Array<{
    tenantId: string;
    tenantSlug: string;
    status: 'purged' | 'failed';
    reportId?: string;
    error?: string;
  }> = [];

  for (const t of eligible) {
    try {
      const outcome = await purgeTenant(t._id, { triggeredBy: 'cron' });
      results.push({ tenantId: String(t._id), tenantSlug: t.slug, status: 'purged', reportId: outcome.reportId });
    } catch (err) {
      if (err instanceof PurgeIneligible || err instanceof PurgeIncomplete) {
        results.push({ tenantId: String(t._id), tenantSlug: t.slug, status: 'failed', error: err.message });
      } else {
        console.error('[run-purges] unexpected error', { tenantId: String(t._id), err });
        results.push({ tenantId: String(t._id), tenantSlug: t.slug, status: 'failed', error: 'Unexpected error' });
      }
    }
  }

  return apiOk({ data: { scanned: eligible.length, results } });
}
