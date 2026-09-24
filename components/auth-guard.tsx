'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { ApiError, api } from '@/lib/api';
import { ErrorState, Skeleton } from '@/components/ui';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<{ user: { is_email_verified: boolean } }>('/auth/session'),
    retry: false,
  });
  const unauthenticated = session.error instanceof ApiError && session.error.status === 401;
  const unverified = Boolean(session.data && !session.data.user.is_email_verified);

  useEffect(() => {
    if (unauthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (unverified) {
      router.replace('/verify-email');
    }
  }, [pathname, router, unauthenticated, unverified]);

  if (session.isLoading || session.isFetching || unauthenticated || unverified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <Skeleton className="h-10 w-48" />
      </main>
    );
  }

  if (session.error) {
    return <ErrorState message="We could not verify your session. Protected content remains locked." retry={() => session.refetch()} />;
  }

  if (!session.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <Skeleton className="h-10 w-48" />
      </main>
    );
  }

  return <>{children}</>;
}
