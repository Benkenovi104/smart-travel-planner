'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from './keys';
import * as api from '../api/usuarios';

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: api.getMe });
}

export function useActualizarMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useGuardarPerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.upsertPerfil,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useIntereses() {
  return useQuery({ queryKey: qk.intereses, queryFn: api.getAllIntereses });
}

export function useMisIntereses() {
  return useQuery({
    queryKey: qk.misIntereses,
    queryFn: api.getMisIntereses,
  });
}

export function useAgregarInteres() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, prioridad }: { id: number; prioridad?: number }) =>
      api.addInteres(id, prioridad),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.misIntereses });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useQuitarInteres() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idInteres: number) => api.removeInteres(idInteres),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.misIntereses });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}
