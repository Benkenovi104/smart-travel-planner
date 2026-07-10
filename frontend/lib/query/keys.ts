/** Query keys centralizadas para invalidación consistente. */
export const qk = {
  me: ['me'] as const,
  intereses: ['intereses'] as const,
  misIntereses: ['me', 'intereses'] as const,
  lugares: (destino: string) => ['lugares', destino] as const,
  lugaresCache: (destino: string, q: string) =>
    ['lugares', 'cache', destino, q] as const,
  viajes: ['viajes'] as const,
  viaje: (id: number) => ['viajes', id] as const,
  itinerario: (id: number) => ['viajes', id, 'itinerario'] as const,
  cambios: (id: number) => ['viajes', id, 'itinerario', 'cambios'] as const,
  presupuesto: (id: number) => ['viajes', id, 'presupuesto'] as const,
  vuelos: (id: number) => ['viajes', id, 'vuelos'] as const,
  alojamiento: (id: number) => ['viajes', id, 'alojamiento'] as const,
};
