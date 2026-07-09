import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/api/server';

/** Logout: borra la cookie de sesión. El backend es stateless (no revoca JWT). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
