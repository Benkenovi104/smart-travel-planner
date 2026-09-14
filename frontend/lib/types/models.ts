/**
 * Modelos del dominio ya normalizados (camelCase consistente, montos numéricos).
 * Es lo que consumen los componentes. La conversión desde el shape crudo de la
 * API (ver `./api.ts`) vive en `lib/api/normalize.ts`.
 */
import type {
  EstadoViaje,
  EstadoActividad,
  RitmoPreferido,
  PresupuestoPreferido,
  TipoViajero,
} from './api';

export type {
  EstadoViaje,
  EstadoActividad,
  RitmoPreferido,
  PresupuestoPreferido,
  TipoViajero,
};

/** Perfil de viajero ya normalizado (camelCase consistente). */
export interface PerfilViajero {
  ritmo: RitmoPreferido | null;
  presupuesto: PresupuestoPreferido | null;
  tipoViajero: TipoViajero | null;
}

export interface Usuario {
  id: number;
  nombre: string | null;
  apellido: string | null;
  email: string;
  fechaRegistro: string | null;
  perfil: PerfilViajero | null;
  intereses: InteresUsuario[];
}

export interface Interes {
  id: number;
  nombre: string;
}

export interface InteresUsuario extends Interes {
  prioridad: number | null;
}

export interface ViajeInteres extends Interes {
  prioridad: number | null;
}

export interface Viaje {
  id: number;
  origen: string;
  destinoPrincipal: string;
  fechaInicio: string;
  fechaFin: string;
  cantidadPersonas: number | null;
  presupuestoTotal: number | null;
  estado: EstadoViaje | null;
  fechaCreacion: string | null;
  intereses: ViajeInteres[];
}

export interface Lugar {
  id: number;
  nombre: string;
  ciudad: string | null;
  pais: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  categoria: string | null;
  rating: number | null;
  precioEstimado: number | null;
  fuenteApi: string | null;
}

export interface Actividad {
  id: number;
  idDia: number;
  orden: number | null;
  horaInicio: string | null;
  horaFin: string | null;
  tipo: string | null;
  costoEstimado: number | null;
  estado: EstadoActividad | null;
  lugar: Lugar;
}

export interface DiaItinerario {
  id: number;
  numeroDia: number;
  fecha: string;
  costoEstimado: number | null;
  actividades: Actividad[];
}

export interface Itinerario {
  id: number;
  idViaje: number;
  fechaGeneracion: string | null;
  tipoGeneracion: string | null;
  dias: DiaItinerario[];
}

export interface CambioItinerario {
  id: number;
  tipo: string | null;
  descripcion: string | null;
  fecha: string | null;
}

/** Línea del desglose de presupuesto (una actividad, el vuelo o el alojamiento elegido). */
export interface GastoEstimado {
  id: number;
  categoria: string | null;
  descripcion: string | null;
  monto: number | null;
}

export interface Presupuesto {
  total: number | null;
  vuelos: number | null;
  alojamiento: number | null;
  actividades: number | null;
  comidas: number | null;
  transporteLocal: number | null;
  gastos: GastoEstimado[];
}

/** Un tramo del viaje: la ida o la vuelta. Se cotizan por separado. */
export interface TramoVuelo {
  aerolinea: string | null;
  salida: string | null;
  llegada: string | null;
  precio: number | null;
  /** Puerta a puerta: incluye el tiempo de escala, no es sólo tiempo de vuelo. */
  duracionMinutos: number | null;
  escalas: number | null;
}

export interface OpcionVuelo {
  id: number;
  origen: string | null;
  destino: string | null;
  fechaSalida: string | null;
  fechaRegreso: string | null;
  aerolinea: string | null;
  /** Total ida+vuelta para todo el grupo (la búsqueda ya consulta por `cantidadPersonas`). */
  precio: number | null;
  moneda: string | null;
  duracionTotal: number | null;
  url: string | null;
  seleccionado: boolean;
  ida: TramoVuelo;
  vuelta: TramoVuelo | null;
}

export interface OpcionAlojamiento {
  id: number;
  nombre: string | null;
  tipo: string | null;
  direccion: string | null;
  precioPorNoche: number | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  fotoUrl?: string;
  fotos?: string[];
  razonRecomendacion?: string;
  seleccionado: boolean;
  /** La IA realmente analizó este hotel (no es un relleno para completar la lista). */
  recomendadoIA: boolean;
  /** `precioPorNoche` es una tarifa real (Booking) y no una banda de Google. */
  precioReal: boolean;
  /** De dónde salió el precio, para poder decirlo en la UI. */
  fuentePrecio: 'booking' | null;
  /** Banda de precio de Google Places: 1 a 4 (de `PRICE_LEVEL_*`). No es un monto. */
  nivelPrecio: number | null;
}

// ---------- Planes de uso ----------

export type Plan = 'GRATIS' | 'BASE' | 'PREMIUM';

export type EstadoSuscripcion =
  | 'PENDIENTE'
  | 'ACTIVA'
  | 'EN_GRACIA'
  | 'CANCELADA'
  | 'VENCIDA';

/** `null` = sin límite; `0` = no incluido en el plan. */
export interface LimitesPlan {
  viajesPorPeriodo: number | null;
  generarPorViaje: number | null;
  regenerarPorViaje: number | null;
  optimizar: boolean;
  alojamientoPorViaje: number | null;
  vuelosPorViaje: number | null;
}

export interface ContadorUso {
  usado: number;
  /** `null` = sin límite. */
  limite: number | null;
}

export interface MiPlan {
  plan: Plan;
  nombrePlan: string;
  /** `null` en el plan Gratis, que no tiene suscripción. */
  estado: EstadoSuscripcion | null;
  idSuscripcion: number | null;
  periodoDesde: string;
  periodoHasta: string;
  vigenteHasta: string | null;
  limites: LimitesPlan;
  viajes: ContadorUso;
  /** Solo si se pidió con `idViaje`. */
  viaje: {
    idViaje: number;
    generarItinerario: ContadorUso;
    regenerarItinerario: ContadorUso;
    buscarAlojamiento: ContadorUso;
    buscarVuelos: ContadorUso;
    optimizar: boolean;
  } | null;
  topeDiario: { itinerario: ContadorUso; busquedas: ContadorUso };
}

export interface CatalogoPlanes {
  planes: {
    plan: Plan;
    nombre: string;
    /** `null` mientras no esté definido. */
    precioMensualArs: number | null;
    limites: LimitesPlan;
  }[];
  topeDiario: { itinerario: number; busquedas: number };
  diasDeGracia: number;
}
