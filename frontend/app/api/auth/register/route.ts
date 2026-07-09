import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, authCookieOptions } from '@/lib/api/server';

/**
 * Registro: crea el usuario en el backend y, si sale bien, deja la sesión
 * iniciada guardando el JWT en la cookie httpOnly.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/auth/register`, {
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

  const res = NextResponse.json({ usuario: data.usuario }, { status: 201 });
  res.cookies.set({ ...authCookieOptions(), value: data.access_token });
  return res;
}
