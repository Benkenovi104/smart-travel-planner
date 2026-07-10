'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from './keys';
import * as api from '../api/viajes';

export function useViajes() {
  return useQuery({ queryKey: qk.viajes, queryFn: api.listViajes });
}

export function useViaje(id: number) {
  return useQuery({
    queryKey: qk.viaje(id),
    queryFn: () => api.getViaje(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useCrearViaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createViaje,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.viajes }),
  });
}

export function useActualizarViaje(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: api.UpdateViajeInput) => api.updateViaje(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.viaje(id) });
      qc.invalidateQueries({ queryKey: qk.viajes });
      // Cambiar las fechas cambia la cantidad de noches y el backend recalcula
      // el presupuesto dentro del mismo PATCH.
      qc.invalidateQueries({ queryKey: qk.presupuesto(id) });
    },
  });
}

export function useEliminarViaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteViaje(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.viajes }),
  });
}
