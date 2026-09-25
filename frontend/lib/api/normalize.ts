/**
 * Convierte el shape crudo de la API (naming mixto, Decimal como string) a los
 * modelos limpios del dominio. Centralizar acá evita que las inconsistencias del
 * backend se filtren a los componentes.
 */
import type {
  ActividadApi,
  CambioItinerarioApi,
  DiaItinerarioApi,
  GastoEstimadoApi,
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
  GastoEstimado,
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
    // Las cuentas anteriores a la migración vienen en true; si el backend es
    // viejo y no manda el campo, se asume verificado para no mostrar el aviso
    // a todo el mundo.
    emailVerificado: u.email_verificado ?? true,
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

export function normalizeGasto(g: GastoEstimadoApi): GastoEstimado {
  return {
    id: g.id_gasto,
    categoria: g.categoria,
    descripcion: g.descripcion,
    monto: num(g.montoEstimado),
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
    gastos: (p.gastos_estimados ?? []).map(normalizeGasto),
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
    seleccionado: v.seleccionado ?? false,
    ida: {
      aerolinea: v.aerolinea,
      salida: v.fechaSalida,
      llegada: v.llegada_ida,
      // Las opciones guardadas antes de que existiera el detalle por tramo no
      // tienen precio_ida: en ese caso no inventamos un desglose.
      precio: num(v.precio_ida),
      duracionMinutos: v.duracion_ida,
      escalas: v.escalas_ida,
    },
    vuelta: v.fecha_regreso
      ? {
          aerolinea: v.aerolinea_vuelta,
          salida: v.fecha_regreso,
          llegada: v.llegada_vuelta,
          precio: num(v.precio_vuelta),
          duracionMinutos: v.duracion_vuelta,
          escalas: v.escalas_vuelta,
        }
      : null,
  };
}

/**
 * Bandas de precio de Google Places. No son montos: sólo dicen si el lugar es
 * barato o caro respecto de su zona.
 */
const NIVEL_PRECIO: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export function normalizeAlojamiento(a: OpcionAlojamientoApi): OpcionAlojamiento {
  let fotoUrl: string | undefined = undefined;
  let fotos: string[] | undefined = undefined;
  let razonRecomendacion: string | undefined = undefined;
  let recomendadoIA = false;
  let precioReal = false;
  let fuentePrecio: 'booking' | null = null;
  let nivelPrecio: number | null = null;
  let webUrl: string | null = a.url_referencia;

  if (a.url_referencia && a.url_referencia.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(a.url_referencia);
      webUrl = parsed.url || parsed.googleMapsUri || null;
      fotoUrl = parsed.fotoUrl || undefined;
      fotos = Array.isArray(parsed.fotos) && parsed.fotos.length > 0 ? parsed.fotos : (parsed.fotoUrl ? [parsed.fotoUrl] : undefined);
      razonRecomendacion = parsed.razon || undefined;
      recomendadoIA = parsed.recomendadaIA === true;
      precioReal = parsed.precioReal === true;
      fuentePrecio = parsed.fuentePrecio === 'booking' ? 'booking' : null;
      nivelPrecio = NIVEL_PRECIO[parsed.nivelPrecio as string] ?? null;
    } catch {
      webUrl = a.url_referencia;
    }
  }

  return {
    id: a.id_alojamiento,
    nombre: a.nombre,
    tipo: a.tipo,
    direccion: a.direccion,
    precioPorNoche: num(a.precio_por_noche),
    rating: num(a.rating),
    lat: num(a.latitud),
    lng: num(a.longitud),
    url: webUrl,
    fotoUrl,
    fotos,
    razonRecomendacion,
    seleccionado: a.seleccionado ?? false,
    recomendadoIA,
    // Las filas viejas (Booking, antes de que existiera la metadata) traen un
    // precio real aunque no lo declaren.
    precioReal: precioReal || (!recomendadoIA && a.precio_por_noche != null),
    fuentePrecio,
    nivelPrecio,
  };
}


