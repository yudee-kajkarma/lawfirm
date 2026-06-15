import type { TenantStatus } from '@/lib/models/Tenant';
import type { OperatorAuditAction } from '@/lib/constants/enums';

export type OperatorTenantListItem = {
  _id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  ownerEmail: string;
  suspendedAt: string | null;
  purgeScheduledAt: string | null;
  createdAt: string;
  userCount: number;
};

export type OperatorTenantDetail = {
  tenant: {
    _id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    ownerEmail: string;
    suspendedAt: string | null;
    purgeScheduledAt: string | null;
    createdAt: string;
  };
  businessUnits: Array<{
    _id: string;
    key: string;
    name: string;
    color: string;
    isActive: boolean;
  }>;
  counts: {
    users: number;
    leadsTotal: number;
    leads7d: number;
    casesTotal: number;
    cases7d: number;
    contactsTotal: number;
    invoicesTotal: number;
  };
};

export type OperatorAuditEntry = {
  _id: string;
  operatorId: string;
  operatorEmail: string;
  action: OperatorAuditAction;
  targetTenantId: string | null;
  targetTenantSlug: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};
