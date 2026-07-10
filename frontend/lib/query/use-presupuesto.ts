'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from './keys';
import * as api from '../api/presupuesto';
import { ApiError } from '../api/client';

export function usePresupuesto(idViaje: number) {
  return useQuery({
    queryKey: qk.presupuesto(idViaje),
    queryFn: () => api.getPresupuesto(idViaje),
    enabled: Number.isFinite(idViaje) && idViaje > 0,
    // Un viaje sin itinerario ni opciones elegidas devuelve 404: no reintentamos.
    retry: (count, error) =>
      error instanceof ApiError && error.status === 404 ? false : count < 1,
  });
}
