import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, getToken } from '@/lib/api/server';

/**
 * BFF proxy genérico: reenvía cualquier /api/<path> al backend NestJS,
 * adjuntando el JWT de la cookie httpOnly como `Authorization: Bearer`.
 * Así el token nunca queda accesible al JS del cliente.
 *
 * Las rutas de auth que setean/borran la cookie (login, register, logout)
 * tienen handlers dedicados y tienen prioridad sobre este catch-all.
 */
async function handler(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const token = await getToken();
  const url = `${BACKEND_URL}/${path.join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  if (token) headers.set('authorization', `Bearer ${token}`);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const backendRes = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    });

    const resBody = await backendRes.arrayBuffer();
    const res = new NextResponse(resBody, { status: backendRes.status });
    const ct = backendRes.headers.get('content-type');
    if (ct) res.headers.set('content-type', ct);
    return res;
  } catch {
    return NextResponse.json(
      { message: 'No se pudo contactar al servidor.' },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
