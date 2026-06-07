import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/auth/adminSession';

export async function POST() {
  const res = NextResponse.json({ ok: true, data: { authenticated: false } });
  res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
