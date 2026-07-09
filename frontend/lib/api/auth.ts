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
