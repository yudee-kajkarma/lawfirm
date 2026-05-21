/**
 * Aggregation-pipeline helpers. The `softDeletePlugin` only hooks query
 * operations (find, updateOne, etc.); aggregations bypass it entirely. Every
 * aggregation that touches a soft-deletable collection must include either
 * `withSoftDeleteMatch()` as its first stage or `deletedAt: null` inside an
 * earlier `$match`.
 */

export function withSoftDeleteMatch() {
  return { $match: { deletedAt: null } };
}

/**
 * Combine the BU-scoped filter (from `scopedQuery`) with the soft-delete
 * guard into a single `$match` stage. Avoids having two adjacent `$match`
 * stages that MongoDB would have to merge anyway.
 */
export function buAndSoftDeleteMatch(buFilter: Record<string, unknown>) {
  return { $match: { ...buFilter, deletedAt: null } };
}
