import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, getToken } from '@/lib/api/server';

export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/perfil/me`, {
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

export async function POST(req: NextRequest) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/perfil/me`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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

export async function PUT(req: NextRequest) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/perfil/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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

export async function PATCH(req: NextRequest) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/perfil/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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
