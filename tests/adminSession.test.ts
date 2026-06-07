import { describe, it, expect } from 'vitest';
import {
  checkCredentials,
  createSessionToken,
  verifySessionToken,
} from '@/lib/auth/adminSession';

const prodEnv = (extra: Record<string, string> = {}) =>
  ({ NODE_ENV: 'production', ...extra }) as unknown as NodeJS.ProcessEnv;

describe('checkCredentials', () => {
  it('accepts the configured username/password', () => {
    const env = prodEnv({ ADMIN_USERNAME: 'boss', ADMIN_PASSWORD: 's3cret' });
    expect(checkCredentials('boss', 's3cret', env)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const env = prodEnv({ ADMIN_USERNAME: 'boss', ADMIN_PASSWORD: 's3cret' });
    expect(checkCredentials('boss', 'nope', env)).toBe(false);
  });

  it('rejects everything when no creds are set in production', () => {
    expect(checkCredentials('admin', 'admin', prodEnv())).toBe(false);
  });

  it('falls back to demo creds outside production', () => {
    const env = { NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv;
    expect(checkCredentials('admin', 'admin', env)).toBe(true);
    expect(checkCredentials('admin', 'wrong', env)).toBe(false);
  });
});

describe('session token', () => {
  const secret = 'test-secret';

  it('round-trips a valid, unexpired token', () => {
    const token = createSessionToken(1000 + 60_000, secret);
    expect(verifySessionToken(token, 1000, secret)).toBe(true);
  });

  it('rejects an expired token', () => {
    const token = createSessionToken(1000, secret);
    expect(verifySessionToken(token, 2000, secret)).toBe(false);
  });

  it('rejects a token signed with another secret', () => {
    const token = createSessionToken(1000 + 60_000, 'other');
    expect(verifySessionToken(token, 1000, secret)).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const token = createSessionToken(1000 + 60_000, secret);
    const tampered = token.replace(/^\d+/, String(9_999_999_999_999));
    expect(verifySessionToken(tampered, 1000, secret)).toBe(false);
  });
});
