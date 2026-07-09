import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, authCookieOptions } from '@/lib/api/server';

/**
 * Login: reenvía credenciales al backend, y si son válidas guarda el JWT en una
 * cookie httpOnly. Al cliente solo le devolvemos el usuario (nunca el token).
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'No se pudo contactar al servidor.' },
      { status: 502 },
    );
  }

  const data = await backendRes.json().catch(() => ({}));
  if (!backendRes.ok) {
    return NextResponse.json(data, { status: backendRes.status });
  }

  const res = NextResponse.json({ usuario: data.usuario }, { status: 200 });
  res.cookies.set({ ...authCookieOptions(), value: data.access_token });
  return res;
}
