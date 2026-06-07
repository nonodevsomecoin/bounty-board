import { NextRequest, NextResponse } from 'next/server';
import {
  checkCredentials,
  createSessionToken,
  getSessionSecret,
  ADMIN_COOKIE,
  ADMIN_TTL_MS,
} from '@/lib/auth/adminSession';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const username = String(body.username ?? '');
  const password = String(body.password ?? '');
  if (!checkCredentials(username, password)) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'Admin login not configured' }, { status: 503 });
  }

  const token = createSessionToken(Date.now() + ADMIN_TTL_MS, secret);
  const res = NextResponse.json({ ok: true, data: { authenticated: true } });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TTL_MS / 1000,
  });
  return res;
}
