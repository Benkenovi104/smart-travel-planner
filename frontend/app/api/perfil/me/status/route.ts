import { NextResponse } from 'next/server';
import { BACKEND_URL, getToken } from '@/lib/api/server';

export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/perfil/me/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { message: 'Error al comunicarse con el backend.' },
      { status: 502 },
    );
  }
}
