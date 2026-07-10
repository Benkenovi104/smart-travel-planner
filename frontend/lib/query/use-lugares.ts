'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from './keys';
import { buscarLugares, buscarLugaresEnCache } from '../api/lugares';

/**
 * Búsqueda por texto entre los lugares ya cacheados (una query barata). Es lo
 * primero que usa el autocompletado; se refetchea por cada texto distinto pero
 * queda cacheada por combinación destino+texto.
 */
export function useLugaresCache(
  destino: string | undefined,
  q: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: qk.lugaresCache(destino ?? '', q),
    queryFn: () => buscarLugaresEnCache(q, destino),
    enabled: Boolean(destino) && q.length >= 2 && enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * POIs del destino vía Google Places (8 búsquedas, 2-4s). Es el FALLBACK del
 * autocompletado cuando la caché no tiene nada del destino. Arranca desactivada
 * y, una vez traída, no se refetchea: los lugares turísticos no cambian durante
 * una sesión (y además el backend ya los dejó cacheados).
 */
export function useLugares(destino: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.lugares(destino ?? ''),
    queryFn: () => buscarLugares(destino!),
    enabled: Boolean(destino) && enabled,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
}
