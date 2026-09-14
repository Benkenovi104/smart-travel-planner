import { ApiError } from '@/lib/api/client';
import type { Plan } from '@/lib/types/models';

/**
 * Cuerpo del 403 con el que el backend rechaza una acción: por el plan
 * (`LIMITE_PLAN`, con el plan que la habilita) o por el tope anti-abuso diario
 * (`TOPE_DIARIO`, igual para todos los planes, así que sin sugerencia).
 */
export interface ErrorDePlan {
  codigo: 'LIMITE_PLAN' | 'TOPE_DIARIO';
  message: string;
  accion: string;
  limite: number;
  usado: number;
  planActual?: Plan;
  planSugerido?: Plan | null;
  /** Solo en los límites por período. */
  renuevaEl?: string | null;
}

function cuerpo(e: unknown, status: number): Record<string, unknown> | null {
  if (!(e instanceof ApiError) || e.status !== status) return null;
  return e.body && typeof e.body === 'object'
    ? (e.body as Record<string, unknown>)
    : null;
}

export function errorDePlan(e: unknown): ErrorDePlan | null {
  const b = cuerpo(e, 403);
  if (b?.codigo !== 'LIMITE_PLAN' && b?.codigo !== 'TOPE_DIARIO') return null;
  return b as unknown as ErrorDePlan;
}

/** 409 al crear un viaje con otro todavía en borrador. */
export function borradorExistente(
  e: unknown,
): { idViaje: number; message: string } | null {
  const b = cuerpo(e, 409);
  if (b?.codigo !== 'BORRADOR_EXISTENTE' || typeof b.idViaje !== 'number') {
    return null;
  }
  return { idViaje: b.idViaje, message: String(b.message ?? '') };
}

/**
 * Errores que ya muestra el manejo global de mutaciones (`app/providers.tsx`).
 * Las pantallas lo chequean antes de su propio toast para no avisar dos veces.
 */
export function errorManejadoGlobal(e: unknown): boolean {
  return errorDePlan(e) !== null || borradorExistente(e) !== null;
}
