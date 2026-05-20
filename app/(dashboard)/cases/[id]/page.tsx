import { CaseDetailClient } from './CaseDetailClient';

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaseDetailClient id={id} />;
}
