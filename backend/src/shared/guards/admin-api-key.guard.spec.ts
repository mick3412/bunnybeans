import { UnauthorizedException } from '@nestjs/common';
import { AdminApiKeyGuard } from './admin-api-key.guard';

function makeCtx(headers: Record<string, string | undefined>) {
  const req = { headers } as any;
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('AdminApiKeyGuard', () => {
  it('allows when ADMIN_API_KEY is unset', () => {
    const guard = new AdminApiKeyGuard({ get: () => undefined } as any);
    const ok = guard.canActivate(makeCtx({ 'x-admin-key': undefined }));
    expect(ok).toBe(true);
  });

  it('throws ADMIN_API_KEY_REQUIRED when key is missing/invalid', () => {
    const guard = new AdminApiKeyGuard({ get: () => 'secret' } as any);
    const ctx = makeCtx({ 'x-admin-key': undefined });

    try {
      guard.canActivate(ctx);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(UnauthorizedException);
      const resp = (e as UnauthorizedException).getResponse() as any;
      expect(resp).toMatchObject({
        code: 'ADMIN_API_KEY_REQUIRED',
      });
      expect(String(resp?.message ?? '')).toContain('Admin API key');
    }
  });

  it('allows when key matches x-admin-key', () => {
    const guard = new AdminApiKeyGuard({ get: () => 'secret' } as any);
    const ok = guard.canActivate(makeCtx({ 'x-admin-key': 'secret' }));
    expect(ok).toBe(true);
  });
});

