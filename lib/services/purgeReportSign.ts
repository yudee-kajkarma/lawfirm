import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.INTEGRATION_SECRET_KEY;
if (!SECRET) {
  throw new Error('INTEGRATION_SECRET_KEY must be set in .env.local for purge-report signing');
}

export type SignablePurgeReport = {
  tenantId: string;
  tenantSlug: string;
  initialDeletes: Record<string, number>;
  verification: Record<string, number>;
};

/**
 * Canonical JSON: keys sorted recursively, no whitespace. Ensures the same
 * logical content always produces the same HMAC, regardless of insertion
 * order. Without this, an HMAC could vary by `JSON.stringify` key order
 * (technically not guaranteed across runtimes / Node versions).
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

export function signPurgeReport(report: SignablePurgeReport): string {
  const payload = canonicalize(report);
  return createHmac('sha256', SECRET!).update(payload).digest('hex');
}

/**
 * Constant-time verification. Returns true iff `report` was signed with the
 * current INTEGRATION_SECRET_KEY using `signPurgeReport`.
 */
export function verifyPurgeReport(report: SignablePurgeReport, hmac: string): boolean {
  const expected = signPurgeReport(report);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hmac, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
