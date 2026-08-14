import { apiFetch } from './client';
import type { PresupuestoPreferido, RitmoPreferido } from '../types/models';

export interface PerfilMeResponse {
  idPerfil?: number;
  idUsuario?: number;
  ritmoPreferido?: RitmoPreferido;
  presupuestoPreferido?: PresupuestoPreferido;
  dietas?: string[];
  movilidad?: string[];
  completado?: boolean;
  intereses?: Array<{ id_interes: number; nombre: string }>;
}

export async function getPerfilMe(): Promise<PerfilMeResponse> {
  return apiFetch<PerfilMeResponse>('perfil/me');
}
