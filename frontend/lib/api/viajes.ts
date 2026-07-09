import { apiFetch } from './client';
import type { ViajeApi } from '../types/api';
import type { EstadoViaje, Viaje } from '../types/models';
import { normalizeViaje } from './normalize';

// La entrada usa snake_case (DTO del backend).
export interface CreateViajeInput {
  origen: string;
  destino_principal: string;
  fecha_inicio: string;
  fecha_fin: string;
  cantidad_personas?: number;
  presupuesto_total?: number;
  intereses?: number[];
}

export type UpdateViajeInput = Partial<CreateViajeInput> & {
  estado?: EstadoViaje;
};

export async function listViajes(): Promise<Viaje[]> {
  const data = await apiFetch<ViajeApi[]>('viajes');
  return data.map(normalizeViaje);
}

export async function getViaje(id: number): Promise<Viaje> {
  return normalizeViaje(await apiFetch<ViajeApi>(`viajes/${id}`));
}

export async function createViaje(input: CreateViajeInput): Promise<Viaje> {
  return normalizeViaje(
    await apiFetch<ViajeApi>('viajes', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateViaje(
  id: number,
  input: UpdateViajeInput,
): Promise<Viaje> {
  return normalizeViaje(
    await apiFetch<ViajeApi>(`viajes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export function deleteViaje(id: number) {
  return apiFetch<unknown>(`viajes/${id}`, { method: 'DELETE' });
}
