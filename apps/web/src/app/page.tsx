import { redirect } from 'next/navigation';

export default function Home() {
  const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
  redirect(disableAuth ? '/dashboard' : '/login');
}

