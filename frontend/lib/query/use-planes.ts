'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from './keys';
import {
  cancelarSuscripcion,
  getCatalogoPlanes,
  getEstadoSuscripcion,
  getMiPlan,
  suscribirPlan,
} from '../api/planes';

export function useCatalogoPlanes() {
  return useQuery({
    queryKey: qk.planes,
    queryFn: getCatalogoPlanes,
    // Los límites y precios casi no cambian.
    staleTime: 5 * 60_000,
  });
}

/**
 * Plan vigente y uso. Solo informa: los límites los aplica el backend. Se
 * refresca después de cada acción que consume (ver `meta.consumePlan` en
 * `app/providers.tsx`).
 */
export function useMiPlan(idViaje?: number) {
  return useQuery({
    queryKey: qk.miPlan(idViaje),
    queryFn: () => getMiPlan(idViaje),
    enabled:
      idViaje === undefined || (Number.isFinite(idViaje) && idViaje > 0),
  });
}

/** Devuelve el link de pago de Mercado Pago. El plan cambia recién cuando se paga. */
export function useSuscribirPlan() {
  return useMutation({ mutationFn: suscribirPlan });
}

export function useCancelarSuscripcion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelarSuscripcion,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.miPlanTodos }),
  });
}

const INTERVALO_CONSULTA_MS = 3_000;

/**
 * Estado de la suscripción que se acaba de pagar. Mientras siga pendiente y
 * `seguirConsultando` sea `true`, vuelve a preguntar cada 3 segundos. Cada
 * consulta hace que el backend la sincronice con Mercado Pago.
 */
export function useEstadoSuscripcion(
  idSuscripcion: number | null,
  seguirConsultando: boolean,
) {
  return useQuery({
    queryKey: qk.suscripcion(idSuscripcion ?? 0),
    queryFn: () => getEstadoSuscripcion(idSuscripcion as number),
    enabled: idSuscripcion !== null,
    refetchInterval: (query) =>
      seguirConsultando && query.state.data?.estado === 'PENDIENTE'
        ? INTERVALO_CONSULTA_MS
        : false,
  });
}
