import { redirect } from 'next/navigation';

// Root → dashboard. Middleware bounces unauthed users to /login.
export default function Home() {
  redirect('/dashboard');
}
