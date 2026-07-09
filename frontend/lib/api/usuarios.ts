import { apiFetch } from './client';
import type { Interes as InteresApi, MeApi, UsuarioInteresApi } from '../types/api';
import type {
  Interes,
  InteresUsuario,
  PresupuestoPreferido,
  RitmoPreferido,
  TipoViajero,
  Usuario,
} from '../types/models';
import { normalizeUsuario } from './normalize';

export async function getMe(): Promise<Usuario> {
  return normalizeUsuario(await apiFetch<MeApi>('usuarios/me'));
}

export interface UpdateUsuarioInput {
  nombre?: string;
  apellido?: string;
}

export async function updateMe(input: UpdateUsuarioInput): Promise<Usuario> {
  return normalizeUsuario(
    await apiFetch<MeApi>('usuarios/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

// El upsert del perfil usa snake_case en la entrada (DTO del backend).
export interface UpsertPerfilInput {
  ritmo_preferido?: RitmoPreferido;
  presupuesto_preferido?: PresupuestoPreferido;
  tipo_viajero?: TipoViajero;
}

export function upsertPerfil(input: UpsertPerfilInput) {
  return apiFetch<unknown>('usuarios/me/perfil', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function getAllIntereses(): Promise<Interes[]> {
  const data = await apiFetch<InteresApi[]>('usuarios/intereses');
  return data.map((i) => ({ id: i.id_interes, nombre: i.nombre }));
}

export async function getMisIntereses(): Promise<InteresUsuario[]> {
  const data = await apiFetch<UsuarioInteresApi[]>('usuarios/me/intereses');
  return data.map((ui) => ({
    id: ui.intereses.id_interes,
    nombre: ui.intereses.nombre,
    prioridad: ui.prioridad,
  }));
}

export function addInteres(id_interes: number, prioridad?: number) {
  return apiFetch<unknown>('usuarios/me/intereses', {
    method: 'POST',
    body: JSON.stringify({ id_interes, prioridad }),
  });
}

export function removeInteres(idInteres: number) {
  return apiFetch<unknown>(`usuarios/me/intereses/${idInteres}`, {
    method: 'DELETE',
  });
}
