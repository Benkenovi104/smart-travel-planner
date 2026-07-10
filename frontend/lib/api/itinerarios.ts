import { apiFetch } from './client';
import type { CambioItinerarioApi, ItinerarioApi } from '../types/api';
import type { CambioItinerario, Itinerario } from '../types/models';
import { normalizeCambio, normalizeItinerario } from './normalize';

export async function generarItinerario(idViaje: number): Promise<Itinerario> {
  return normalizeItinerario(
    await apiFetch<ItinerarioApi>(`viajes/${idViaje}/itinerario/generar`, {
      method: 'POST',
    }),
  );
}

export async function getItinerario(idViaje: number): Promise<Itinerario> {
  return normalizeItinerario(
    await apiFetch<ItinerarioApi>(`viajes/${idViaje}/itinerario`),
  );
}

export async function getHistorialCambios(
  idViaje: number,
): Promise<CambioItinerario[]> {
  const data = await apiFetch<CambioItinerarioApi[]>(
    `viajes/${idViaje}/itinerario/cambios`,
  );
  return data.map(normalizeCambio);
}

// ---------- Edición manual (entrada en snake_case, DTOs del backend) ----------
export interface CreateActividadInput {
  id_lugar?: number;
  nombre_lugar?: string;
  ciudad?: string;
  pais?: string;
  categoria?: string;
  precio_estimado?: number;
  tipo_actividad?: string;
  hora_inicio?: string;
  hora_fin?: string;
  costo_estimado?: number;
  orden?: number;
}

export function agregarActividad(
  idViaje: number,
  idDia: number,
  input: CreateActividadInput,
) {
  return apiFetch<unknown>(
    `viajes/${idViaje}/itinerario/dias/${idDia}/actividades`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export interface UpdateActividadInput {
  tipo_actividad?: string;
  hora_inicio?: string;
  hora_fin?: string;
  costo_estimado?: number;
  estado?: 'pendiente' | 'completada' | 'cancelada';
}

export function editarActividad(
  idViaje: number,
  idActividad: number,
  input: UpdateActividadInput,
) {
  return apiFetch<unknown>(
    `viajes/${idViaje}/itinerario/actividades/${idActividad}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function eliminarActividad(idViaje: number, idActividad: number) {
  return apiFetch<unknown>(
    `viajes/${idViaje}/itinerario/actividades/${idActividad}`,
    { method: 'DELETE' },
  );
}

export interface MoverActividadInput {
  id_dia_destino: number;
  orden?: number;
}

export function moverActividad(
  idViaje: number,
  idActividad: number,
  input: MoverActividadInput,
) {
  return apiFetch<unknown>(
    `viajes/${idViaje}/itinerario/actividades/${idActividad}/mover`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function optimizarDia(idViaje: number, idDia: number) {
  return apiFetch<{ optimizada: boolean }>(
    `viajes/${idViaje}/itinerario/dias/${idDia}/optimizar`,
    { method: 'POST' },
  );
}

export interface GeocodificarResult {
  total: number;
  ubicados: number;
}

export function geocodificarFaltantes(idViaje: number) {
  return apiFetch<GeocodificarResult>(
    `viajes/${idViaje}/itinerario/geocodificar`,
    { method: 'POST' },
  );
}
