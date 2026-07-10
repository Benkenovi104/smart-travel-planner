import { apiFetch } from './client';
import type { PresupuestoApi } from '../types/api';
import type { Presupuesto } from '../types/models';
import { normalizePresupuesto } from './normalize';

/** Devuelve 404 mientras el viaje no tenga itinerario ni opciones elegidas. */
export async function getPresupuesto(idViaje: number): Promise<Presupuesto> {
  return normalizePresupuesto(
    await apiFetch<PresupuestoApi>(`viajes/${idViaje}/presupuesto`),
  );
}
