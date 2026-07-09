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

export interface Presupuesto {
  total: number | null;
  vuelos: number | null;
  alojamiento: number | null;
  actividades: number | null;
  comidas: number | null;
  transporteLocal: number | null;
}

export interface OpcionVuelo {
  id: number;
  origen: string | null;
  destino: string | null;
  fechaSalida: string | null;
  fechaRegreso: string | null;
  aerolinea: string | null;
  precio: number | null;
  moneda: string | null;
  duracionTotal: number | null;
  url: string | null;
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
}
