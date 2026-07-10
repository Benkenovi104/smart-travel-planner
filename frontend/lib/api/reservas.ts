import { apiFetch } from './client';
import type { OpcionAlojamientoApi, OpcionVueloApi } from '../types/api';
import type { OpcionAlojamiento, OpcionVuelo } from '../types/models';
import { normalizeAlojamiento, normalizeVuelo } from './normalize';

// ---------- Vuelos ----------

export async function getVuelos(idViaje: number): Promise<OpcionVuelo[]> {
  const data = await apiFetch<OpcionVueloApi[]>(`viajes/${idViaje}/vuelos`);
  return data.map(normalizeVuelo);
}

/** Consulta la API externa y reemplaza las opciones guardadas. Puede dar 429 (free tier). */
export async function buscarVuelos(idViaje: number): Promise<OpcionVuelo[]> {
  const data = await apiFetch<OpcionVueloApi[]>(
    `viajes/${idViaje}/vuelos/buscar`,
    { method: 'POST' },
  );
  return data.map(normalizeVuelo);
}

/** La selección es exclusiva por viaje y recalcula el presupuesto en el backend. */
export async function seleccionarVuelo(
  idViaje: number,
  idVuelo: number,
  seleccionado: boolean,
): Promise<OpcionVuelo[]> {
  const data = await apiFetch<OpcionVueloApi[]>(
    `viajes/${idViaje}/vuelos/${idVuelo}/seleccionar`,
    { method: 'PATCH', body: JSON.stringify({ seleccionado }) },
  );
  return data.map(normalizeVuelo);
}

// ---------- Alojamiento ----------

export async function getAlojamiento(
  idViaje: number,
): Promise<OpcionAlojamiento[]> {
  const data = await apiFetch<OpcionAlojamientoApi[]>(
    `viajes/${idViaje}/alojamiento`,
  );
  return data.map(normalizeAlojamiento);
}

/** Consulta la API externa y reemplaza las opciones guardadas. Puede dar 429 (free tier). */
export async function buscarAlojamiento(
  idViaje: number,
): Promise<OpcionAlojamiento[]> {
  const data = await apiFetch<OpcionAlojamientoApi[]>(
    `viajes/${idViaje}/alojamiento/buscar`,
    { method: 'POST' },
  );
  return data.map(normalizeAlojamiento);
}

/** La selección es exclusiva por viaje y recalcula el presupuesto en el backend. */
export async function seleccionarAlojamiento(
  idViaje: number,
  idAlojamiento: number,
  seleccionado: boolean,
): Promise<OpcionAlojamiento[]> {
  const data = await apiFetch<OpcionAlojamientoApi[]>(
    `viajes/${idViaje}/alojamiento/${idAlojamiento}/seleccionar`,
    { method: 'PATCH', body: JSON.stringify({ seleccionado }) },
  );
  return data.map(normalizeAlojamiento);
}
