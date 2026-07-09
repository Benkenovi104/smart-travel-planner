'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { qk } from './keys';
import * as api from '../api/itinerarios';
import { ApiError } from '../api/client';
import type { Itinerario } from '../types/models';

/** Invalida lo que cambia al tocar el itinerario (itinerario, presupuesto, historial). */
function invalidarItinerario(qc: QueryClient, idViaje: number) {
  qc.invalidateQueries({ queryKey: qk.itinerario(idViaje) });
  qc.invalidateQueries({ queryKey: qk.presupuesto(idViaje) });
  qc.invalidateQueries({ queryKey: qk.cambios(idViaje) });
}

/** Aplica un movimiento de actividad sobre el itinerario en memoria (optimista). */
function aplicarMovimiento(
  it: Itinerario,
  idActividad: number,
  idDiaDestino: number,
  orden?: number,
): Itinerario {
  let movida: Itinerario['dias'][number]['actividades'][number] | undefined;

  const sinActividad = it.dias.map((d) => {
    const idx = d.actividades.findIndex((a) => a.id === idActividad);
    if (idx >= 0) {
      movida = d.actividades[idx];
      return {
        ...d,
        actividades: d.actividades.filter((a) => a.id !== idActividad),
      };
    }
    return { ...d, actividades: [...d.actividades] };
  });

  if (!movida) return it;
  const target = { ...movida, idDia: idDiaDestino };

  const dias = sinActividad.map((d) => {
    if (d.id !== idDiaDestino) return d;
    const acts = [...d.actividades];
    const pos =
      orden != null ? Math.min(Math.max(orden - 1, 0), acts.length) : acts.length;
    acts.splice(pos, 0, target);
    return { ...d, actividades: acts.map((a, i) => ({ ...a, orden: i + 1 })) };
  });

  return { ...it, dias };
}

export function useItinerario(idViaje: number) {
  return useQuery({
    queryKey: qk.itinerario(idViaje),
    queryFn: () => api.getItinerario(idViaje),
    enabled: Number.isFinite(idViaje) && idViaje > 0,
    // Un viaje sin itinerario devuelve 404: no reintentamos en ese caso.
    retry: (count, error) =>
      error instanceof ApiError && error.status === 404 ? false : count < 1,
  });
}

export function useGenerarItinerario(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.generarItinerario(idViaje),
    onSuccess: (data) => {
      qc.setQueryData(qk.itinerario(idViaje), data);
      // Regenerar recalcula presupuesto en el backend.
      qc.invalidateQueries({ queryKey: qk.presupuesto(idViaje) });
      qc.invalidateQueries({ queryKey: qk.cambios(idViaje) });
    },
  });
}

export function useHistorialCambios(idViaje: number, enabled = true) {
  return useQuery({
    queryKey: qk.cambios(idViaje),
    queryFn: () => api.getHistorialCambios(idViaje),
    enabled: enabled && Number.isFinite(idViaje) && idViaje > 0,
  });
}

export function useAgregarActividad(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { idDia: number; input: api.CreateActividadInput }) =>
      api.agregarActividad(idViaje, vars.idDia, vars.input),
    onSuccess: () => invalidarItinerario(qc, idViaje),
  });
}

export function useEditarActividad(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      idActividad: number;
      input: api.UpdateActividadInput;
    }) => api.editarActividad(idViaje, vars.idActividad, vars.input),
    onSuccess: () => invalidarItinerario(qc, idViaje),
  });
}

export function useEliminarActividad(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idActividad: number) =>
      api.eliminarActividad(idViaje, idActividad),
    onSuccess: () => invalidarItinerario(qc, idViaje),
  });
}

export function useGeocodificar(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.geocodificarFaltantes(idViaje),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.itinerario(idViaje) }),
  });
}

export function useMoverActividad(idViaje: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      idActividad: number;
      idDiaDestino: number;
      orden?: number;
    }) =>
      api.moverActividad(idViaje, vars.idActividad, {
        id_dia_destino: vars.idDiaDestino,
        orden: vars.orden,
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.itinerario(idViaje) });
      const prev = qc.getQueryData<Itinerario>(qk.itinerario(idViaje));
      if (prev) {
        qc.setQueryData(
          qk.itinerario(idViaje),
          aplicarMovimiento(prev, vars.idActividad, vars.idDiaDestino, vars.orden),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.itinerario(idViaje), ctx.prev);
    },
    onSettled: () => invalidarItinerario(qc, idViaje),
  });
}
