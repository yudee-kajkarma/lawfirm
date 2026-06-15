import { TenantDetailClient } from './TenantDetailClient';

type Props = { params: Promise<{ id: string }> };

export default async function TenantDetailPage({ params }: Props) {
  const { id } = await params;
  return <TenantDetailClient tenantId={id} />;
}
