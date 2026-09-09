'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { ApiError, api } from '@/lib/api';
import { Skeleton } from '@/components/ui';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<{ user: unknown }>('/auth/session'),
    retry: false,
  });
  const unauthenticated = session.error instanceof ApiError && session.error.status === 401;

  useEffect(() => {
    if (unauthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, unauthenticated]);

  if (session.isLoading || unauthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <Skeleton className="h-10 w-48" />
      </main>
    );
  }

  return <>{children}</>;
}
