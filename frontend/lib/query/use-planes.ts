'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from './keys';
import { getCatalogoPlanes, getMiPlan } from '../api/planes';

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
