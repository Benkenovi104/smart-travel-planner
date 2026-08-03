import { Badge } from '@/components/ui/badge';
import type { EstadoViaje } from '@/lib/types/models';

/** Mismo orden y mismos valores que `ESTADOS_VIAJE` del backend. */
export const ESTADOS_VIAJE: EstadoViaje[] = [
  'borrador',
  'planificado',
  'en_progreso',
  'completado',
  'cancelado',
];

/**
 * Los que el usuario puede elegir a mano. `borrador` queda afuera: lo maneja
 * el wizard de creación, y volver a marcarlo a mano dejaría al viaje atrapado
 * en el wizard.
 */
export const ESTADOS_VIAJE_MANUALES: EstadoViaje[] = ESTADOS_VIAJE.filter(
  (e) => e !== 'borrador',
);

export const ESTADO_MAP: Record<
  EstadoViaje,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  borrador: { label: 'Borrador', variant: 'outline' },
  planificado: { label: 'Planificado', variant: 'secondary' },
  en_progreso: { label: 'En progreso', variant: 'default' },
  completado: { label: 'Completado', variant: 'outline' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
};

export function EstadoBadge({ estado }: { estado: EstadoViaje | null }) {
  const cfg = (estado && ESTADO_MAP[estado]) || {
    label: estado ?? 'Sin estado',
    variant: 'secondary' as const,
  };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
