import { NextRequest, NextResponse } from 'next/server';

/**
 * Guard optimista de rutas (en Next 16 el antiguo `middleware` se llama `proxy`).
 * Solo mira la presencia de la cookie de sesión para redirigir; la validación
 * real del JWT la hace el backend NestJS en cada request. No es la única capa
 * de seguridad, es UX para no mostrar pantallas privadas sin sesión.
 */
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? 'stp_token';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Sin sesión en una ruta privada -> al login (recordando a dónde iba).
  if (!token && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión en una ruta de auth -> al dashboard.
  if (token && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Corre en páginas, no en /api (el BFF ya delega la auth al backend),
  // ni en assets estáticos.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
