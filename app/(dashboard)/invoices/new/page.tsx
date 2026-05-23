import { NewInvoiceClient } from './NewInvoiceClient';

type SearchParams = {
  clientId?: string;
  caseId?: string;
  businessUnit?: string;
  title?: string;
};

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return <NewInvoiceClient initialClientId={params.clientId} initialCaseId={params.caseId} initialBusinessUnit={params.businessUnit} initialTitle={params.title} />;
}
