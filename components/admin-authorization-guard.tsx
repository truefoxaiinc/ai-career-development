'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { ErrorState, Skeleton } from '@/components/ui';

/**
 * UX gate only: the backend's require_admin dependency is the authority.
 * The endpoint accepts both user.role=admin and delegated AdminRole records.
 */
export function AdminAuthorizationGuard({ children }: { children: React.ReactNode }) {
  const access = useQuery({
    queryKey: ['admin', 'authorization'],
    queryFn: () => api.get('/admin/dashboard'),
    retry: false,
    staleTime: 30_000,
  });

  if (access.isPending || access.isFetching) {
    return <main className="flex min-h-screen items-center justify-center"><Skeleton className="h-10 w-48" /></main>;
  }

  if (access.error instanceof ApiError && access.error.status === 403) {
    return <main className="mx-auto max-w-xl p-8" role="alert"><h1 className="text-xl font-semibold">Access denied</h1><p className="mt-2">Administrator permissions are required to view this page.</p></main>;
  }

  if (access.error) {
    return <ErrorState message="Could not verify administrator access. No admin content was loaded." retry={() => access.refetch()} />;
  }

  if (!access.data) {
    return <ErrorState message="Administrator access could not be confirmed." retry={() => access.refetch()} />;
  }

  return <>{children}</>;
}
