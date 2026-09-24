import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ get: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/jobs',
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  },
  api: { get: mocks.get },
}));

import { AuthGuard } from '@/components/auth-guard';
import { ApiError } from '@/lib/api';

function renderGuard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AuthGuard><div>Protected content</div></AuthGuard></QueryClientProvider>);
}

describe('AuthGuard', () => {
  beforeEach(() => { mocks.get.mockReset(); mocks.replace.mockReset(); });
  afterEach(() => vi.restoreAllMocks());

  it('does not render protected content while session status is loading', () => {
    mocks.get.mockReturnValue(new Promise(() => {}));
    renderGuard();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated user and keeps protected content hidden', async () => {
    mocks.get.mockRejectedValue(new ApiError('unauthorized', 401));
    renderGuard();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login?next=%2Fdashboard%2Fjobs'));
  });

  it('fails closed with a retry state when session status cannot be verified', async () => {
    mocks.get.mockRejectedValue(new Error('network unavailable'));
    renderGuard();
    expect(await screen.findByRole('alert')).toHaveTextContent('Protected content remains locked');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders protected content only for a verified session', async () => {
    mocks.get.mockResolvedValue({ user: { is_email_verified: true } });
    renderGuard();
    expect(await screen.findByText('Protected content')).toBeInTheDocument();
  });

  it('sends an unverified session to email verification without rendering protected content', async () => {
    mocks.get.mockResolvedValue({ user: { is_email_verified: false } });
    renderGuard();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/verify-email'));
  });
});
