import type { CaseStatus, ContactType, LeadStage } from '@/lib/constants/enums';

export type DashboardMetrics = {
  scope: {
    businessUnit: string | null; // 'all' or specific BU key
  };
  leads: {
    total: number;
    open: number;
    byStage: Record<LeadStage, number>;
    /** converted / (converted + lost) — null if both are zero. */
    conversionRate: number | null;
    /** Sum of `value` for non-terminal leads (excludes converted + lost). */
    pipelineValue: number;
  };
  cases: {
    total: number;
    active: number; // not 'closed'
    byStatus: Record<CaseStatus, number>;
    totalValue: number;
  };
  contacts: {
    total: number;
    byType: Record<ContactType, number>;
  };
  tasks: {
    todo: number | null;
    overdue: number | null;
  };
};
