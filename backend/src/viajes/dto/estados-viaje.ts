/**
 * Estados válidos de un viaje. Alineado con `EstadoBadge` del frontend.
 *
 * `borrador` es el estado inicial: el viaje ya existe (hace falta para buscar
 * vuelos y alojamiento, que van scopeados a `:idViaje`) pero el usuario todavía
 * está pasando por el wizard de creación. Pasa a `planificado` al terminarlo.
 * No se ofrece en el selector manual de estado del frontend.
 */
export const ESTADOS_VIAJE = [
  'borrador',
  'planificado',
  'en_progreso',
  'completado',
  'cancelado',
] as const;

export type EstadoViaje = (typeof ESTADOS_VIAJE)[number];
