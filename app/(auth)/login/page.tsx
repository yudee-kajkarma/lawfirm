import { LoginForm } from './LoginForm';

type Props = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = params.error;
  const callbackUrl = params.callbackUrl ?? '/dashboard';

  return <LoginForm callbackUrl={callbackUrl} initialError={!!error} />;
}
