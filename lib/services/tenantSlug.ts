import type { ClientSession } from 'mongoose';

import { Tenant } from '@/lib/models/Tenant';

/**
 * Convert "Smith & Co." → "smith-co". Strips non-alphanumerics, collapses
 * runs of separators, trims dashes from ends, lowercases. Output is always
 * URL-safe and matches the slug regex in tenants schema.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (combining marks U+0300–U+036F)
    .replace(/[^a-z0-9]+/g, '-') // any non-alnum run → single dash
    .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
    .slice(0, 60); // cap to keep URLs readable
}

/**
 * Returns a slug guaranteed not to collide with an existing Tenant. If the
 * base slug is taken, appends a numeric suffix (-2, -3, …) until free.
 * MUST be called inside the same session as the Tenant.create so the slug
 * stays unique across racing signups.
 */
export async function generateUniqueTenantSlug(
  baseInput: string,
  session?: ClientSession,
): Promise<string> {
  const base = slugify(baseInput) || 'firm';
  let candidate = base;
  let suffix = 2;
  for (let i = 0; i < 100; i++) {
    // Tenant is above the tenant boundary — no tenantId filter needed here.
    const existing = await Tenant.findOne({ slug: candidate }).session(session ?? null);
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
  throw new Error(`Could not generate a unique tenant slug from "${baseInput}" after 100 attempts`);
}
