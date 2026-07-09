import 'server-only';
import { cookies } from 'next/headers';

/** URL base del backend NestJS (incluye el prefijo /api). Solo lado servidor. */
export const BACKEND_URL =
  process.env.BACKEND_URL ?? 'http://localhost:3000/api';

/** Nombre de la cookie httpOnly donde guardamos el JWT. */
export const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? 'stp_token';

/** Lee el JWT de la cookie httpOnly (o undefined si no hay sesión). */
export async function getToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value;
}

/** Opciones estándar de la cookie de sesión (7 días, igual que el JWT). */
export function authCookieOptions() {
  return {
    name: AUTH_COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}
