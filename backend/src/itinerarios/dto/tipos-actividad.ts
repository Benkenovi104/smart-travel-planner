/**
 * Tipos válidos de actividad de un itinerario.
 *
 * `alojamiento` NO está: el alojamiento es un costo del viaje, no algo que pase
 * en un día a una hora. El usuario elige un hotel por viaje desde el módulo
 * `alojamiento`, y de ahí sale `monto_alojamiento` del presupuesto.
 */
export const TIPOS_ACTIVIDAD = [
  'visita',
  'comida',
  'transporte',
  'entretenimiento',
] as const;
