import type { Types } from 'mongoose';

import { connectDb } from '@/lib/db/connect';
import type { OperatorAuditAction } from '@/lib/constants/enums';
import { OperatorAuditLog } from '@/lib/models/OperatorAuditLog';

import type { HydratedOperator } from '@/lib/auth/withOperatorAuth';

export type WriteOperatorAuditInput = {
  operator: HydratedOperator;
  action: OperatorAuditAction;
  targetTenant?: { _id: Types.ObjectId | string; slug: string } | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Single chokepoint for writing to operatorAuditLogs. Never throws — if the
 * audit write fails, the main operator action must still complete.
 */
export async function writeOperatorAudit(input: WriteOperatorAuditInput): Promise<void> {
  try {
    await connectDb();
    await OperatorAuditLog.create({
      operatorId: input.operator._id,
      operatorEmail: input.operator.email,
      action: input.action,
      targetTenantId: input.targetTenant?._id ?? null,
      targetTenantSlug: input.targetTenant?.slug ?? null,
      details: input.details ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    console.error('[operatorAudit] failed to write entry', { action: input.action, err });
  }
}
