/** Estados válidos de un viaje. Alineado con `EstadoBadge` del frontend. */
export const ESTADOS_VIAJE = [
  'planificado',
  'en_progreso',
  'completado',
  'cancelado',
] as const;

export type EstadoViaje = (typeof ESTADOS_VIAJE)[number];
