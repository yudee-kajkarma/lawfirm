import { Types, type Model, type PipelineStage } from 'mongoose';

/**
 * Wrapper around `Model.aggregate()` that prepends
 *   { $match: { tenantId, deletedAt: null } }
 * to every pipeline. Use this instead of `Model.aggregate(...)` everywhere
 * EXCEPT the three legitimate raw-aggregate sites:
 *
 *   1. This file (the helper IS the wrapped call).
 *   2. `scripts/test-tenant-scope.ts` — uses raw aggregate to prove the leak
 *      that justifies the helper's existence.
 *   3. `app/api/operator/tenants/route.ts` — operator-surface user counts,
 *      cross-tenant by design, per-line eslint-disable with rationale.
 *
 * The eslint rule in `eslint.config.mjs` enforces this. New cross-tenant
 * operator code should add a per-line `// eslint-disable-next-line ...`
 * comment with `cross-tenant, intentional` in the rationale (greppable).
 */

type TenantScopedUser = { tenantId: string };

export async function tenantAggregate<TResult = Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  user: TenantScopedUser,
  pipeline: PipelineStage[],
): Promise<TResult[]> {
  if (!user.tenantId || !Types.ObjectId.isValid(user.tenantId)) {
    throw new Error(
      `[tenantAggregate] called with invalid tenantId="${user.tenantId}" on model ${model.modelName}`,
    );
  }
  const tenantId = new Types.ObjectId(user.tenantId);
  return model.aggregate<TResult>([
    { $match: { tenantId, deletedAt: null } },
    ...pipeline,
  ]);
}
