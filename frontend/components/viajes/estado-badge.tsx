import { Badge } from '@/components/ui/badge';
import type { EstadoViaje } from '@/lib/types/models';

/** Mismo orden y mismos valores que `ESTADOS_VIAJE` del backend. */
export const ESTADOS_VIAJE: EstadoViaje[] = [
  'planificado',
  'en_progreso',
  'completado',
  'cancelado',
];

export const ESTADO_MAP: Record<
  EstadoViaje,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
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
