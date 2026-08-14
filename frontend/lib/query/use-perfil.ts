'use client';

import { useQuery } from '@tanstack/react-query';
import { qk } from './keys';
import { getPerfilMe } from '../api/perfil';

export function usePerfilMe() {
  return useQuery({
    queryKey: qk.perfilMe,
    queryFn: getPerfilMe,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
