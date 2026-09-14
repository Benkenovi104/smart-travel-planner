import { apiFetch } from './client';
import type {
  CancelacionSuscripcion,
  CatalogoPlanes,
  EstadoPagoSuscripcion,
  MiPlan,
  PlanPago,
  SuscripcionCreada,
} from '../types/models';

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

/** Crea la suscripción en Mercado Pago. No cambia el plan: eso pasa al pagar. */
export async function suscribirPlan(plan: PlanPago): Promise<SuscripcionCreada> {
  return apiFetch<SuscripcionCreada>('planes/suscribir', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

export async function cancelarSuscripcion(): Promise<CancelacionSuscripcion> {
  return apiFetch<CancelacionSuscripcion>('planes/cancelar', { method: 'POST' });
}

/** Si sigue pendiente, el backend la sincroniza con Mercado Pago antes de responder. */
export async function getEstadoSuscripcion(
  idSuscripcion: number,
): Promise<EstadoPagoSuscripcion> {
  return apiFetch<EstadoPagoSuscripcion>(`planes/suscripciones/${idSuscripcion}`);
}
