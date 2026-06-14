import { scopedQuery } from '../auth/scopedQuery';
import type { HydratedUser } from '../auth/withAuth';
import {
  CASE_STATUSES,
  CONTACT_TYPES,
  LEAD_STAGES,
  type CaseStatus,
  type ContactType,
  type LeadStage,
} from '../constants/enums';
import { tenantAggregate } from '../tenancy/tenantAggregate';
import { Case } from '../models/Case';
import { Contact } from '../models/Contact';
import { Lead } from '../models/Lead';

import type { DashboardMetrics } from '@/types/dashboard';

const TERMINAL_LEAD_STAGES: LeadStage[] = ['converted', 'lost'];

type AggBucket = { _id: string; count: number };
type AggValue = { _id: null; total: number };

function bucketsToRecord<K extends string>(
  buckets: AggBucket[],
  keys: readonly K[],
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = 0;
  for (const b of buckets) {
    if ((keys as readonly string[]).includes(b._id)) {
      out[b._id as K] = b.count;
    }
  }
  return out;
}

export async function getDashboardMetrics(
  user: HydratedUser,
  requestedBU: string | null,
): Promise<DashboardMetrics> {
  const fullFilter = scopedQuery(user, requestedBU) as Record<string, unknown>;
  // tenantAggregate prepends { tenantId, deletedAt: null } so strip tenantId to avoid
  // doubling it in the pipeline $match.
  const buOnlyFilter = Object.fromEntries(
    Object.entries(fullFilter).filter(([k]) => k !== 'tenantId'),
  );
  const baseMatch = { $match: buOnlyFilter };

  // Parallel aggregations — 6 round-trips at once, no dependencies between them.
  const [
    leadStagesAgg,
    caseStatusesAgg,
    contactTypesAgg,
    conversionAgg,
    pipelineValueAgg,
    caseValueAgg,
  ] = await Promise.all([
    tenantAggregate<AggBucket>(Lead, user, [baseMatch, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
    tenantAggregate<AggBucket>(Case, user, [baseMatch, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    tenantAggregate<AggBucket>(Contact, user, [
      baseMatch,
      { $group: { _id: '$contactType', count: { $sum: 1 } } },
    ]),
    // Conversion rate input — only the terminal stages matter.
    tenantAggregate<AggBucket>(Lead, user, [
      { $match: { ...buOnlyFilter, stage: { $in: TERMINAL_LEAD_STAGES } } },
      { $group: { _id: '$stage', count: { $sum: 1 } } },
    ]),
    // Pipeline value — non-terminal leads with a positive value.
    tenantAggregate<AggValue>(Lead, user, [
      {
        $match: {
          ...buOnlyFilter,
          stage: { $nin: TERMINAL_LEAD_STAGES },
          value: { $gt: 0 },
        },
      },
      { $group: { _id: null, total: { $sum: '$value' } } },
    ]),
    // Total case value — across all non-closed cases.
    tenantAggregate<AggValue>(Case, user, [
      { $match: { ...buOnlyFilter, status: { $ne: 'closed' }, value: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$value' } } },
    ]),
  ]);

  const leadsByStage = bucketsToRecord<LeadStage>(leadStagesAgg, LEAD_STAGES);
  const casesByStatus = bucketsToRecord<CaseStatus>(caseStatusesAgg, CASE_STATUSES);
  const contactsByType = bucketsToRecord<ContactType>(contactTypesAgg, CONTACT_TYPES);

  const totalLeads = leadStagesAgg.reduce((acc, b) => acc + b.count, 0);
  const openLeads = totalLeads - leadsByStage.converted - leadsByStage.lost;

  const totalCases = caseStatusesAgg.reduce((acc, b) => acc + b.count, 0);
  const activeCases = totalCases - casesByStatus.closed;

  const totalContacts = contactTypesAgg.reduce((acc, b) => acc + b.count, 0);

  let converted = 0;
  let lost = 0;
  for (const b of conversionAgg) {
    if (b._id === 'converted') converted = b.count;
    if (b._id === 'lost') lost = b.count;
  }
  const denom = converted + lost;
  const conversionRate = denom === 0 ? null : converted / denom;

  return {
    scope: { businessUnit: requestedBU },
    leads: {
      total: totalLeads,
      open: openLeads,
      byStage: leadsByStage,
      conversionRate,
      pipelineValue: pipelineValueAgg[0]?.total ?? 0,
    },
    cases: {
      total: totalCases,
      active: activeCases,
      byStatus: casesByStatus,
      totalValue: caseValueAgg[0]?.total ?? 0,
    },
    contacts: {
      total: totalContacts,
      byType: contactsByType,
    },
    tasks: {
      // Stubbed until Phase 6 builds the Task model.
      todo: null,
      overdue: null,
    },
  };
}
