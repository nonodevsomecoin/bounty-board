import { cookies } from 'next/headers';
import { ADMIN_COOKIE, getSessionSecret, verifySessionToken } from './adminSession';

// Server-only: true when the request carries a valid, unexpired admin session
// cookie. Used by the admin page and the admin write routes.
export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = getSessionSecret();
  if (!secret) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!token && verifySessionToken(token, Date.now(), secret);
}
