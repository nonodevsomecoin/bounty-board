import crypto from 'node:crypto';

export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Resolves the admin username/password. In production they MUST come from env;
// in development we fall back to demo creds so the panel is usable locally.
function resolveCredentials(env: NodeJS.ProcessEnv): { user: string; pass: string } | null {
  let user = env.ADMIN_USERNAME;
  let pass = env.ADMIN_PASSWORD;
  if ((!user || !pass) && env.NODE_ENV !== 'production') {
    user = 'admin';
    pass = 'admin';
  }
  if (!user || !pass) return null;
  return { user, pass };
}

export function checkCredentials(
  username: string,
  password: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const creds = resolveCredentials(env);
  if (!creds) return false;
  // Evaluate both comparisons so the result doesn't reveal which field failed.
  const userOk = safeEqual(username, creds.user);
  const passOk = safeEqual(password, creds.pass);
  return userOk && passOk;
}

// Secret used to sign session tokens. Production requires an explicit secret;
// development uses a fixed insecure one so login works without setup.
export function getSessionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.ADMIN_SESSION_SECRET) return env.ADMIN_SESSION_SECRET;
  if (env.NODE_ENV !== 'production') return 'dev-only-insecure-secret';
  return null;
}

function sign(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSessionToken(expiresAtMs: number, secret: string): string {
  const payload = String(expiresAtMs);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string,
  nowMs: number,
  secret: string,
): boolean {
  if (!secret) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(payload, secret))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && nowMs < exp;
}
