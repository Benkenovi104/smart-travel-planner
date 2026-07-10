'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from './keys';
import { buscarLugares } from '../api/lugares';

/**
 * POIs del destino, para el autocompletado al agregar una actividad.
 *
 * Cada llamada al backend son 8 búsquedas contra Google Places, así que la query
 * arranca desactivada (`enabled`) hasta que el usuario efectivamente quiere buscar,
 * y una vez traída no se refetchea: los lugares turísticos de una ciudad no cambian
 * durante una sesión.
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
