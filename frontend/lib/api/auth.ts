import { apiFetch } from './client';
import type { UsuarioBasico } from '../types/api';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
}

/** Login vía BFF: la cookie httpOnly se setea del lado del servidor. */
export function login(input: LoginInput) {
  return apiFetch<{ usuario: UsuarioBasico }>('auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function register(input: RegisterInput) {
  return apiFetch<{ usuario: UsuarioBasico }>('auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout() {
  return apiFetch<{ ok: true }>('auth/logout', { method: 'POST' });
}

/**
 * Pide el email de recuperación. El backend responde siempre lo mismo exista o
 * no el email, para no revelar qué cuentas están registradas: la UI tiene que
 * mostrar el mismo mensaje en los dos casos.
 */
export function forgotPassword(email: string) {
  return apiFetch<{ message: string }>('auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(input: { token: string; password_nueva: string }) {
  return apiFetch<{ message: string }>('auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function changePassword(input: {
  password_actual: string;
  password_nueva: string;
}) {
  return apiFetch<{ message: string }>('auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
