import { NewCaseClient } from './NewCaseClient';

type SearchParams = {
  clientId?: string;
  businessUnit?: string;
  title?: string;
};

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <NewCaseClient
      initialClientId={params.clientId}
      initialBusinessUnit={params.businessUnit}
      initialTitle={params.title}
    />
  );
}
