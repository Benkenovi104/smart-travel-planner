import { apiFetch } from './client';
import type { LugarApi } from '../types/api';
import type { Lugar } from '../types/models';
import { normalizeLugar } from './normalize';

export interface CiudadSugerida {
  id: string;
  descripcion: string;
  ciudad: string;
  pais: string | null;
}

/**
 * Autocompletado de ciudades (Google Places) para Origen y Destino al crear/editar un viaje.
 */
export async function autocompleteCiudades(
  q: string,
): Promise<CiudadSugerida[]> {
  if (!q || q.trim().length < 2) return [];
  const params = new URLSearchParams({ q });
  return apiFetch<CiudadSugerida[]>(
    `lugares/ciudades/autocomplete?${params.toString()}`,
  );
}

/**
 * Búsqueda por texto entre los lugares YA cacheados en la base (una query, sin
 * pegarle a Google Places). Es lo primero que usa el autocompletado; barato y
 * apto para llamar en cada tecla.
 */
export async function buscarLugaresEnCache(
  q: string,
  destino?: string,
): Promise<Lugar[]> {
  const params = new URLSearchParams({ q });
  if (destino) params.set('destino', destino);
  const data = await apiFetch<LugarApi[]>(`lugares?${params.toString()}`);
  return data.map(normalizeLugar);
}

/**
 * Trae los POIs turísticos de un destino (Google Places, cacheados en la tabla
 * `lugares` del backend).
 *
 * ⚠️ Caro: no filtra por texto, dispara una búsqueda a Google por cada categoría
 * (8 llamadas, 2-4s). Es el fallback del autocompletado cuando `buscarLugaresEnCache`
 * no encuentra nada (destino nunca buscado); una vez corrido, cachea los lugares
 * y las siguientes búsquedas del mismo destino salen por la caché.
 */
export async function buscarLugares(destino: string): Promise<Lugar[]> {
  const data = await apiFetch<LugarApi[]>(
    `lugares/buscar?destino=${encodeURIComponent(destino)}`,
  );
  return data.map(normalizeLugar);
}
