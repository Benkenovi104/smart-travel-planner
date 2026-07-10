'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from './keys';
import * as api from '../api/reservas';
import type { OpcionAlojamiento, OpcionVuelo } from '../types/models';

/**
 * Buscar opciones y elegir una recalculan el presupuesto en el backend, así que
 * la respuesta refresca la lista y además invalida el presupuesto.
 */

// ---------- Vuelos ----------

export function useVuelos(idViaje: number) {
  return useQuery({
    queryKey: qk.vuelos(idViaje),
    queryFn: () => api.getVuelos(idViaje),
    enabled: Number.isFinite(idViaje) && idViaje > 0,
  });
}

export function useBuscarVuelos(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.buscarVuelos(idViaje),
    onSuccess: (data) => {
      qc.setQueryData(qk.vuelos(idViaje), data);
      qc.invalidateQueries({ queryKey: qk.presupuesto(idViaje) });
    },
  });
}

export function useSeleccionarVuelo(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { idVuelo: number; seleccionado: boolean }) =>
      api.seleccionarVuelo(idViaje, vars.idVuelo, vars.seleccionado),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.vuelos(idViaje) });
      const prev = qc.getQueryData<OpcionVuelo[]>(qk.vuelos(idViaje));
      if (prev) {
        // La selección es exclusiva: marcamos la elegida y desmarcamos el resto.
        qc.setQueryData(
          qk.vuelos(idViaje),
          prev.map((v) => ({
            ...v,
            seleccionado: v.id === vars.idVuelo ? vars.seleccionado : false,
          })),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.vuelos(idViaje), ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(qk.vuelos(idViaje), data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.presupuesto(idViaje) });
    },
  });
}

// ---------- Alojamiento ----------

export function useAlojamiento(idViaje: number) {
  return useQuery({
    queryKey: qk.alojamiento(idViaje),
    queryFn: () => api.getAlojamiento(idViaje),
    enabled: Number.isFinite(idViaje) && idViaje > 0,
  });
}

export function useBuscarAlojamiento(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.buscarAlojamiento(idViaje),
    onSuccess: (data) => {
      qc.setQueryData(qk.alojamiento(idViaje), data);
      qc.invalidateQueries({ queryKey: qk.presupuesto(idViaje) });
    },
  });
}

export function useSeleccionarAlojamiento(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { idAlojamiento: number; seleccionado: boolean }) =>
      api.seleccionarAlojamiento(
        idViaje,
        vars.idAlojamiento,
        vars.seleccionado,
      ),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.alojamiento(idViaje) });
      const prev = qc.getQueryData<OpcionAlojamiento[]>(qk.alojamiento(idViaje));
      if (prev) {
        qc.setQueryData(
          qk.alojamiento(idViaje),
          prev.map((a) => ({
            ...a,
            seleccionado:
              a.id === vars.idAlojamiento ? vars.seleccionado : false,
          })),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.alojamiento(idViaje), ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(qk.alojamiento(idViaje), data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.presupuesto(idViaje) });
    },
  });
}
