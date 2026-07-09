/**
 * Contratos de datos tal como los devuelve el backend NestJS.
 *
 * ⚠️ Gotcha: el backend serializa con naming MIXTO (Prisma devuelve el nombre de
 * campo del modelo, no el de la columna) y los `Decimal` viajan como `string`.
 * Estas interfaces reflejan exactamente el shape crudo de la API. La capa de
 * `lib/api/` normaliza esto a shapes limpios antes de llegar a los componentes.
 */

// ---------- Auth ----------
export interface UsuarioBasico {
  id_usuario: number;
  nombre: string | null;
  apellido: string | null;
  email: string;
  fecha_registro: string | null;
}

export interface AuthResponse {
  usuario: UsuarioBasico;
  access_token: string;
}

// ---------- Usuario / perfil / intereses ----------
export type RitmoPreferido = 'relajado' | 'moderado' | 'intenso';
export type PresupuestoPreferido = 'económico' | 'moderado' | 'premium' | 'lujo';
export type TipoViajero = 'solo' | 'pareja' | 'familia' | 'grupo' | 'negocios';

export interface Interes {
  id_interes: number;
  nombre: string;
}

export interface UsuarioInteresApi {
  prioridad: number | null;
  intereses: Interes;
}

// Shape del perfil en la respuesta de GET /usuarios/me (naming mixto del backend).
export interface PerfilViajeroApi {
  ritmoPreferido: RitmoPreferido | null;
  presupuesto_preferido: PresupuestoPreferido | null;
  tipoViajero: TipoViajero | null;
}

export interface MeApi {
  id_usuario: number;
  nombre: string | null;
  apellido: string | null;
  email: string;
  fecha_registro: string | null;
  perfil_viajero: PerfilViajeroApi | null;
  usuario_intereses: UsuarioInteresApi[];
}

// ---------- Viajes ----------
export type EstadoViaje =
  | 'planificado'
  | 'en_progreso'
  | 'completado'
  | 'cancelado';

export interface ViajeInteresApi {
  prioridad: number | null;
  intereses: Interes;
}

export interface ViajeApi {
  id_viaje: number;
  origen: string;
  destino_principal: string;
  fechaInicio: string; // camelCase (ISO date)
  fechaFin: string; // camelCase
  cantidadPersonas: number | null; // camelCase
  presupuestoTotal: string | null; // Decimal -> string
  estado: EstadoViaje | null;
  fecha_creacion: string | null; // snake_case
  viaje_intereses: ViajeInteresApi[];
}

// ---------- Itinerario ----------
export interface LugarApi {
  id_lugar: number;
  nombre: string;
  ciudad: string | null;
  pais: string | null;
  direccion: string | null;
  latitud: string | null; // Decimal -> string
  longitud: string | null; // Decimal -> string
  categoria: string | null;
  rating: string | null;
  precio_estimado: string | null;
  fuente_api: string | null;
}

export type EstadoActividad = 'pendiente' | 'completada' | 'cancelada';

export interface ActividadApi {
  id_actividad: number;
  id_dia_itinerario: number;
  id_lugar: number;
  orden: number | null;
  hora_inicio_estimada: string | null;
  hora_fin_estimada: string | null;
  tipo_actividad: string | null;
  costoEstimado: string | null; // camelCase
  estado: EstadoActividad | null;
  lugares: LugarApi;
}

export interface DiaItinerarioApi {
  id_dia_itinerario: number;
  numeroDia: number; // camelCase
  fecha: string;
  costo_estimado_dia: string | null;
  actividades_itinerario: ActividadApi[];
}

export interface ItinerarioApi {
  id_itinerario: number;
  id_viaje: number;
  fecha_generacion: string | null;
  tipo_generacion: string | null;
  dias_itinerario: DiaItinerarioApi[];
}

export interface CambioItinerarioApi {
  id_cambio: number;
  tipo_cambio: string | null;
  descripcion: string | null;
  fecha_cambio: string | null;
}

// ---------- Presupuesto ----------
export interface PresupuestoApi {
  monto_total: string | null;
  monto_vuelos: string | null;
  monto_alojamiento: string | null;
  monto_actividades: string | null;
  monto_comidas: string | null;
  monto_transporte_local: string | null;
}

// ---------- Transporte ----------
export interface OpcionVueloApi {
  id_vuelo: number;
  origen: string | null;
  destino: string | null;
  fechaSalida: string | null; // camelCase
  fecha_regreso: string | null; // snake_case
  aerolinea: string | null;
  precio: string | null;
  moneda: string | null;
  duracion_total: number | null;
  url_referencia: string | null;
}

export interface OpcionAlojamientoApi {
  id_alojamiento: number;
  nombre: string | null;
  tipo: string | null;
  direccion: string | null;
  precio_por_noche: string | null;
  rating: string | null;
  latitud: string | null;
  longitud: string | null;
  url_referencia: string | null;
}
