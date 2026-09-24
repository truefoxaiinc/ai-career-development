import { describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';

describe('API authentication refresh', () => {
  it('clears server auth cookies when refresh is rejected and returns the original 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { code: 'unauthorized', message: 'Session expired' } }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { code: 'unauthorized', message: 'Refresh expired' } }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { message: 'Logged out' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(api.get('/profile')).rejects.toMatchObject({ status: 401, message: 'Session expired' });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[2][0])).toContain('/auth/logout');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
