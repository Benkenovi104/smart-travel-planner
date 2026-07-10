import { apiFetch } from './client';
import type { LugarApi } from '../types/api';
import type { Lugar } from '../types/models';
import { normalizeLugar } from './normalize';

/**
 * Trae los POIs turísticos de un destino (Google Places, cacheados en la tabla
 * `lugares` del backend).
 *
 * ⚠️ No es un autocompletado: el endpoint no filtra por texto, devuelve la tanda
 * entera del destino y dispara una búsqueda a Google por cada categoría. Se llama
 * una sola vez por destino y el filtrado por lo que escribe el usuario se hace en
 * el cliente (ver `useLugares`).
 */
export async function buscarLugares(destino: string): Promise<Lugar[]> {
  const data = await apiFetch<LugarApi[]>(
    `lugares/buscar?destino=${encodeURIComponent(destino)}`,
  );
  return data.map(normalizeLugar);
}
