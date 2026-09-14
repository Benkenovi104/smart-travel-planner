import { apiFetch } from './client';
import type { CatalogoPlanes, MiPlan } from '../types/models';

/**
 * El backend devuelve los planes en camelCase y sin `Decimal`, así que a
 * diferencia del resto de `lib/api` no hace falta normalizar.
 */
export async function getCatalogoPlanes(): Promise<CatalogoPlanes> {
  return apiFetch<CatalogoPlanes>('planes');
}

/** Con `idViaje`, además del uso del período trae los contadores de ese viaje. */
export async function getMiPlan(idViaje?: number): Promise<MiPlan> {
  return apiFetch<MiPlan>(
    idViaje ? `planes/mi-plan?idViaje=${idViaje}` : 'planes/mi-plan',
  );
}
