import { Types, type Model, type PipelineStage } from 'mongoose';

/**
 * Wrapper around `Model.aggregate()` that prepends
 *   { $match: { tenantId, deletedAt: null } }
 * to every pipeline. Use this instead of `Model.aggregate(...)` everywhere.
 *
 * Aggregations bypass Mongoose middleware, which means `tenantScopePlugin`
 * cannot enforce tenant scoping on them. This helper is the single chokepoint
 * for aggregation; the `no-restricted-syntax` eslint rule in `eslint.config.mjs`
 * bans raw `.aggregate(` calls in app code.
 *
 * Operator-console code that legitimately needs cross-tenant aggregation
 * disables the eslint rule on a per-line basis with a rationale comment.
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
