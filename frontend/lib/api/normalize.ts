/**
 * Convierte el shape crudo de la API (naming mixto, Decimal como string) a los
 * modelos limpios del dominio. Centralizar acá evita que las inconsistencias del
 * backend se filtren a los componentes.
 */
import type {
  ActividadApi,
  CambioItinerarioApi,
  DiaItinerarioApi,
  ItinerarioApi,
  LugarApi,
  MeApi,
  OpcionAlojamientoApi,
  OpcionVueloApi,
  PresupuestoApi,
  ViajeApi,
} from '../types/api';
import type {
  Actividad,
  CambioItinerario,
  DiaItinerario,
  Itinerario,
  Lugar,
  OpcionAlojamiento,
  OpcionVuelo,
  Presupuesto,
  Usuario,
  Viaje,
} from '../types/models';

/** Decimal (string | null) -> number | null */
function num(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function normalizeUsuario(u: MeApi): Usuario {
  const p = u.perfil_viajero;
  return {
    id: u.id_usuario,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    fechaRegistro: u.fecha_registro,
    perfil: p
      ? {
          ritmo: p.ritmoPreferido,
          presupuesto: p.presupuesto_preferido,
          tipoViajero: p.tipoViajero,
        }
      : null,
    intereses: (u.usuario_intereses ?? []).map((ui) => ({
      id: ui.intereses.id_interes,
      nombre: ui.intereses.nombre,
      prioridad: ui.prioridad,
    })),
  };
}

export function normalizeViaje(v: ViajeApi): Viaje {
  return {
    id: v.id_viaje,
    origen: v.origen,
    destinoPrincipal: v.destino_principal,
    fechaInicio: v.fechaInicio,
    fechaFin: v.fechaFin,
    cantidadPersonas: v.cantidadPersonas,
    presupuestoTotal: num(v.presupuestoTotal),
    estado: v.estado,
    fechaCreacion: v.fecha_creacion,
    intereses: (v.viaje_intereses ?? []).map((vi) => ({
      id: vi.intereses.id_interes,
      nombre: vi.intereses.nombre,
      prioridad: vi.prioridad,
    })),
  };
}

export function normalizeLugar(l: LugarApi): Lugar {
  return {
    id: l.id_lugar,
    nombre: l.nombre,
    ciudad: l.ciudad,
    pais: l.pais,
    direccion: l.direccion,
    lat: num(l.latitud),
    lng: num(l.longitud),
    categoria: l.categoria,
    rating: num(l.rating),
    precioEstimado: num(l.precio_estimado),
    fuenteApi: l.fuente_api,
  };
}

export function normalizeActividad(a: ActividadApi): Actividad {
  return {
    id: a.id_actividad,
    idDia: a.id_dia_itinerario,
    orden: a.orden,
    horaInicio: a.hora_inicio_estimada,
    horaFin: a.hora_fin_estimada,
    tipo: a.tipo_actividad,
    costoEstimado: num(a.costoEstimado),
    estado: a.estado,
    lugar: normalizeLugar(a.lugares),
  };
}

export function normalizeDia(d: DiaItinerarioApi): DiaItinerario {
  return {
    id: d.id_dia_itinerario,
    numeroDia: d.numeroDia,
    fecha: d.fecha,
    costoEstimado: num(d.costo_estimado_dia),
    actividades: (d.actividades_itinerario ?? [])
      .map(normalizeActividad)
      .sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0)),
  };
}

export function normalizeItinerario(i: ItinerarioApi): Itinerario {
  return {
    id: i.id_itinerario,
    idViaje: i.id_viaje,
    fechaGeneracion: i.fecha_generacion,
    tipoGeneracion: i.tipo_generacion,
    dias: (i.dias_itinerario ?? [])
      .map(normalizeDia)
      .sort((a, b) => a.numeroDia - b.numeroDia),
  };
}

export function normalizeCambio(c: CambioItinerarioApi): CambioItinerario {
  return {
    id: c.id_cambio,
    tipo: c.tipo_cambio,
    descripcion: c.descripcion,
    fecha: c.fecha_cambio,
  };
}

export function normalizePresupuesto(p: PresupuestoApi): Presupuesto {
  return {
    total: num(p.monto_total),
    vuelos: num(p.monto_vuelos),
    alojamiento: num(p.monto_alojamiento),
    actividades: num(p.monto_actividades),
    comidas: num(p.monto_comidas),
    transporteLocal: num(p.monto_transporte_local),
  };
}

export function normalizeVuelo(v: OpcionVueloApi): OpcionVuelo {
  return {
    id: v.id_vuelo,
    origen: v.origen,
    destino: v.destino,
    fechaSalida: v.fechaSalida,
    fechaRegreso: v.fecha_regreso,
    aerolinea: v.aerolinea,
    precio: num(v.precio),
    moneda: v.moneda,
    duracionTotal: v.duracion_total,
    url: v.url_referencia,
  };
}

export function normalizeAlojamiento(a: OpcionAlojamientoApi): OpcionAlojamiento {
  return {
    id: a.id_alojamiento,
    nombre: a.nombre,
    tipo: a.tipo,
    direccion: a.direccion,
    precioPorNoche: num(a.precio_por_noche),
    rating: num(a.rating),
    lat: num(a.latitud),
    lng: num(a.longitud),
    url: a.url_referencia,
  };
}
