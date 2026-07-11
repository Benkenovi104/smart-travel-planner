import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Lugar } from '../../generated/prisma/client.js';
import { GeminiService } from './gemini.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';
import { LugaresService } from '../lugares/lugares.service.js';
import { GeocodingService } from '../lugares/geocoding.service.js';
import { CreateActividadDto } from './dto/create-actividad.dto.js';
import { UpdateActividadDto } from './dto/update-actividad.dto.js';
import { MoverActividadDto } from './dto/mover-actividad.dto.js';

type Tx = Prisma.TransactionClient;

interface Punto {
  lat: number;
  lng: number;
}

/** Los horarios se guardan como Time sobre el 1970-01-01; "HH:mm" para mensajes. */
function horaHHmm(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/**
 * ¿Se pisan dos franjas horarias? El fin ausente se toma como el propio inicio
 * (actividad puntual). Mismo inicio siempre es conflicto; para los rangos vale
 * el solapamiento medio-abierto, así dos actividades pegadas (10:00–11:00 y
 * 11:00–12:00) no chocan.
 */
function seSolapan(
  aInicio: Date,
  aFin: Date | null,
  bInicio: Date | null,
  bFin: Date | null,
): boolean {
  if (!bInicio) return false;
  if (aInicio.getTime() === bInicio.getTime()) return true;
  const aStart = aInicio.getTime();
  const aEnd = (aFin ?? aInicio).getTime();
  const bStart = bInicio.getTime();
  const bEnd = (bFin ?? bInicio).getTime();
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Distancia al cuadrado entre dos puntos (aprox. equirectangular). Alcanza para
 * comparar/ordenar a escala de ciudad y evita la raíz y la trigonometría de
 * haversine; el factor cos(lat) corrige que un grado de longitud sea más corto
 * que uno de latitud. No es una distancia en km, sólo sirve para comparar.
 */
function dist2<T extends Punto>(a: T, b: T): number {
  const latMedia = (((a.lat + b.lat) / 2) * Math.PI) / 180;
  const dx = (b.lng - a.lng) * Math.cos(latMedia);
  const dy = b.lat - a.lat;
  return dx * dx + dy * dy;
}

/** Largo total de un recorrido abierto (suma de tramos consecutivos). */
function largoRuta<T extends Punto>(ruta: T[]): number {
  let total = 0;
  for (let i = 1; i < ruta.length; i++) total += Math.sqrt(dist2(ruta[i - 1], ruta[i]));
  return total;
}

/**
 * Ordena por vecino más cercano arrancando desde el primer punto (que se
 * mantiene como inicio del día): en cada paso salta a la parada no visitada más
 * cercana.
 */
function nearestNeighbor<T extends Punto>(puntos: T[]): T[] {
  const restantes = puntos.slice(1);
  const ruta: T[] = [puntos[0]];
  while (restantes.length) {
    const ultimo = ruta[ruta.length - 1];
    let mejor = 0;
    let mejorD = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = dist2(ultimo, restantes[i]);
      if (d < mejorD) {
        mejorD = d;
        mejor = i;
      }
    }
    ruta.push(restantes.splice(mejor, 1)[0]);
  }
  return ruta;
}

/**
 * Mejora una ruta con 2-opt: mientras encuentre un par de tramos que se cruzan,
 * invierte el segmento intermedio. El punto 0 queda fijo (inicio del día). Para
 * los pocos puntos de un día (≤ ~10) el costo es despreciable.
 */
function dosOpt<T extends Punto>(ruta: T[]): T[] {
  const n = ruta.length;
  if (n < 4) return ruta;
  let mejora = true;
  while (mejora) {
    mejora = false;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const candidata = [
          ...ruta.slice(0, i),
          ...ruta.slice(i, j + 1).reverse(),
          ...ruta.slice(j + 1),
        ];
        if (largoRuta(candidata) < largoRuta(ruta) - 1e-12) {
          ruta = candidata;
          mejora = true;
        }
      }
    }
  }
  return ruta;
}

// Dos paradas a más de esta distancia se consideran de zonas distintas (ciudades
// separadas). Dentro de una ciudad los POIs están muy por debajo; entre ciudades
// (ej. Córdoba y Villa Carlos Paz, ~35 km) muy por encima.
const UMBRAL_CLUSTER_KM = 12;

/** Distancia aproximada en km (equirectangular). Sólo para el umbral de clusters. */
function distKm<T extends Punto>(a: T, b: T): number {
  return Math.sqrt(dist2(a, b)) * 111.32;
}

/**
 * Agrupa puntos por cercanía (single-linkage con union-find): dos puntos caen en
 * el mismo cluster si hay una cadena de saltos < UMBRAL_CLUSTER_KM entre ellos.
 * Así un día multi-ciudad queda en un cluster por ciudad.
 */
function clusterizar<T extends Punto>(puntos: T[]): T[][] {
  const n = puntos.length;
  const padre = puntos.map((_, i) => i);
  const find = (x: number): number => {
    while (padre[x] !== x) {
      padre[x] = padre[padre[x]];
      x = padre[x];
    }
    return x;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (distKm(puntos[i], puntos[j]) < UMBRAL_CLUSTER_KM) {
        padre[find(i)] = find(j);
      }
    }
  }
  const grupos = new Map<number, T[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r)!.push(puntos[i]);
  }
  return [...grupos.values()];
}

function centroide<T extends Punto>(cluster: T[]): Punto {
  const lat = cluster.reduce((s, p) => s + p.lat, 0) / cluster.length;
  const lng = cluster.reduce((s, p) => s + p.lng, 0) / cluster.length;
  return { lat, lng };
}

/**
 * Ordena los clusters para minimizar el viaje entre zonas, arrancando por el que
 * contiene el `inicio` (así el día empieza donde venía empezando) y saltando por
 * vecino más cercano entre centroides.
 */
function ordenarClusters<T extends Punto>(clusters: T[][], inicio: T): T[][] {
  if (clusters.length <= 1) return clusters;
  const centros = clusters.map((c) => ({ cluster: c, ...centroide(c) }));
  const startIdx = clusters.findIndex((c) => c.includes(inicio));
  const orden = [centros[startIdx]];
  const restantes = centros.filter((_, i) => i !== startIdx);
  while (restantes.length) {
    const ultimo = orden[orden.length - 1];
    let mejor = 0;
    let mejorD = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = dist2(ultimo, restantes[i]);
      if (d < mejorD) {
        mejorD = d;
        mejor = i;
      }
    }
    orden.push(restantes.splice(mejor, 1)[0]);
  }
  return orden.map((o) => o.cluster);
}

@Injectable()
export class ItinerariosService {
  private readonly logger = new Logger(ItinerariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly presupuestos: PresupuestosService,
    private readonly lugares: LugaresService,
    private readonly geocoding: GeocodingService,
  ) {}

  private static readonly MS_POR_DIA = 24 * 60 * 60 * 1000;

  /**
   * Reajusta los días del itinerario a un nuevo rango de fechas del viaje.
   * Pensado para llamarse desde la transacción de `ViajesService.update`.
   *
   * El día N va siempre en `fechaInicio + (N-1) días`, y la cantidad de días es
   * `diff(inicio, fin) + 1`. Al cambiar el rango:
   * - se recalcula la `fecha` de los días que sobreviven,
   * - se borran los días que sobran (con sus actividades) si el viaje se acortó,
   * - se crean días vacíos al final si se alargó.
   *
   * No recalcula el presupuesto: de eso se encarga quien llama, después, porque
   * borrar días puede haber sacado actividades. Si el viaje no tiene itinerario,
   * no hace nada.
   */
  async reajustarFechasEnTx(
    tx: Tx,
    id_viaje: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<void> {
    const itinerario = await tx.itinerario.findUnique({ where: { id_viaje } });
    if (!itinerario) return;

    const dias = await tx.diaItinerario.findMany({
      where: { id_itinerario: itinerario.id_itinerario },
      orderBy: { numeroDia: 'asc' },
    });
    if (dias.length === 0) return;

    // fechaInicio/fechaFin están a medianoche UTC: la resta da días enteros.
    const totalDias =
      Math.round(
        (fechaFin.getTime() - fechaInicio.getTime()) /
          ItinerariosService.MS_POR_DIA,
      ) + 1;

    const fechaDeDia = (numeroDia: number) =>
      new Date(
        fechaInicio.getTime() + (numeroDia - 1) * ItinerariosService.MS_POR_DIA,
      );

    // Días que sobran: se borran del más nuevo al más viejo, con sus actividades.
    const sobran = dias.filter((d) => d.numeroDia > totalDias);
    if (sobran.length > 0) {
      const ids = sobran.map((d) => d.id_dia_itinerario);
      await tx.actividadItinerario.deleteMany({
        where: { id_dia_itinerario: { in: ids } },
      });
      await tx.diaItinerario.deleteMany({
        where: { id_dia_itinerario: { in: ids } },
      });
    }

    // Días que sobreviven: se reescribe su fecha sólo si cambió. Cuando sólo se
    // movió `fecha_fin` (acortar/alargar), `fecha_inicio` no cambia y las fechas
    // de estos días quedan iguales, así que no se toca ninguno: menos queries
    // dentro de la transacción, que contra una base remota es lo que importa.
    for (const dia of dias) {
      if (dia.numeroDia > totalDias) continue;
      const nueva = fechaDeDia(dia.numeroDia);
      if (dia.fecha && nueva.getTime() === dia.fecha.getTime()) continue;
      await tx.diaItinerario.update({
        where: { id_dia_itinerario: dia.id_dia_itinerario },
        data: { fecha: nueva },
      });
    }

    // Días que faltan: se crean vacíos al final.
    const maxExistente = dias[dias.length - 1].numeroDia;
    for (let n = maxExistente + 1; n <= totalDias; n++) {
      await tx.diaItinerario.create({
        data: {
          id_itinerario: itinerario.id_itinerario,
          numeroDia: n,
          fecha: fechaDeDia(n),
        },
      });
    }
  }

  async generar(id_usuario: number, id_viaje: number) {
    // Verificar que el viaje pertenece al usuario
    const viaje = await this.prisma.viaje.findUnique({
      where: { id_viaje },
      include: {
        viaje_intereses: { include: { intereses: true } },
        usuarios: { include: { perfil_viajero: true } },
      },
    });

    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    // Preparar parámetros para la IA
    const intereses = viaje.viaje_intereses.map((vi) => vi.intereses.nombre);
    const perfil = viaje.usuarios.perfil_viajero;

    // Buscar lugares reales (Google Places) para fundamentar a la IA en datos
    // verificados. Si falla (destino raro, API caída), no bloqueamos la
    // generación: Gemini sigue funcionando solo con su propio conocimiento.
    const lugaresReales: Lugar[] = await this.lugares
      .buscarYCachear(viaje.destino_principal)
      .catch((error: unknown) => {
        const mensaje = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `No se pudieron obtener lugares reales para "${viaje.destino_principal}": ${mensaje}`,
        );
        return [] as Lugar[];
      });

    const itinerarioIA = await this.gemini.generarItinerario({
      origen: viaje.origen,
      destino: viaje.destino_principal,
      fecha_inicio: viaje.fechaInicio.toISOString().split('T')[0],
      fecha_fin: viaje.fechaFin.toISOString().split('T')[0],
      cantidad_personas: viaje.cantidadPersonas ?? 1,
      presupuesto_total: Number(viaje.presupuestoTotal ?? 1000),
      intereses,
      tipo_viajero: perfil?.tipoViajero ?? undefined,
      ritmo_preferido: perfil?.ritmoPreferido ?? undefined,
      lugares_disponibles: lugaresReales.map((l) => ({
        nombre: l.nombre,
        ciudad: l.ciudad ?? viaje.destino_principal,
        categoria: l.categoria ?? 'otro',
        latitud: l.latitud ? Number(l.latitud) : undefined,
        longitud: l.longitud ? Number(l.longitud) : undefined,
      })),
    });

    // El alojamiento es un costo del viaje, no una actividad de un día: el usuario
    // elige su hotel aparte. Al prompt se lo pedimos, pero el modelo igual las
    // genera a veces, así que las descartamos acá.
    for (const diaIA of itinerarioIA.dias) {
      diaIA.actividades = diaIA.actividades.filter(
        (a) => a.tipo_actividad !== 'alojamiento',
      );
    }

    // Resolver los lugares ANTES de la transacción: son un caché compartido
    // (Google Places / generaciones previas) y no necesitan ser atómicos con el
    // itinerario. Hacerlo acá evita que N lookups+inserts contra Supabase (cada
    // uno con latencia de red) agoten el presupuesto de tiempo de la transacción
    // interactiva y disparen Prisma P2028.
    const lugaresMap = new Map<string, number>();
    for (const diaIA of itinerarioIA.dias) {
      for (const actIA of diaIA.actividades) {
        const key = `${actIA.nombre_lugar}|${actIA.ciudad}`;
        if (!lugaresMap.has(key)) {
          const existente = await this.prisma.lugar.findFirst({
            where: {
              nombre: { equals: actIA.nombre_lugar, mode: 'insensitive' },
              ...(actIA.ciudad && {
                ciudad: { equals: actIA.ciudad, mode: 'insensitive' },
              }),
            },
          });

          if (existente) {
            lugaresMap.set(key, existente.id_lugar);
          } else {
            const lugar = await this.prisma.lugar.create({
              data: {
                nombre: actIA.nombre_lugar,
                ciudad: actIA.ciudad,
                pais: actIA.pais,
                categoria: actIA.categoria,
                precio_estimado: actIA.costo_estimado,
                duracionEstimadaMin: actIA.duracion_minutos,
                latitud: actIA.latitud ?? undefined,
                longitud: actIA.longitud ?? undefined,
                fuente_api: 'gemini',
              },
            });
            lugaresMap.set(key, lugar.id_lugar);
          }
        }
      }
    }

    // Las escrituras del itinerario van en una única transacción: si algo falla
    // a mitad de camino, no queda un itinerario a medio generar.
    await this.prisma.$transaction(
      async (tx) => {
        // Borrar itinerario previo si existe (cascade manual: no hay onDelete
        // cascade en el schema, así que hay que borrar hijos antes que el padre)
        const itinerarioPrevio = await tx.itinerario.findUnique({
          where: { id_viaje },
        });
        if (itinerarioPrevio) {
          await tx.actividadItinerario.deleteMany({
            where: {
              dias_itinerario: {
                id_itinerario: itinerarioPrevio.id_itinerario,
              },
            },
          });
          await tx.diaItinerario.deleteMany({
            where: { id_itinerario: itinerarioPrevio.id_itinerario },
          });
          await tx.cambioItinerario.deleteMany({
            where: { id_itinerario: itinerarioPrevio.id_itinerario },
          });
          await tx.itinerario.delete({ where: { id_viaje } });
        }

        // Crear itinerario
        const nuevoItinerario = await tx.itinerario.create({
          data: {
            id_viaje,
            fecha_generacion: new Date(),
            tipo_generacion: 'ai',
          },
        });

        // Crear días y actividades
        for (const diaIA of itinerarioIA.dias) {
          const dia = await tx.diaItinerario.create({
            data: {
              id_itinerario: nuevoItinerario.id_itinerario,
              numeroDia: diaIA.numero_dia,
              fecha: new Date(diaIA.fecha),
              costo_estimado_dia: diaIA.costo_estimado_dia,
            },
          });

          await tx.actividadItinerario.createMany({
            data: diaIA.actividades.map((actIA, idx) => ({
              id_dia_itinerario: dia.id_dia_itinerario,
              id_lugar: lugaresMap.get(
                `${actIA.nombre_lugar}|${actIA.ciudad}`,
              )!,
              orden: idx + 1,
              hora_inicio_estimada: actIA.hora_inicio
                ? new Date(`1970-01-01T${actIA.hora_inicio}:00Z`)
                : undefined,
              hora_fin_estimada: actIA.hora_fin
                ? new Date(`1970-01-01T${actIA.hora_fin}:00Z`)
                : undefined,
              tipo_actividad: actIA.tipo_actividad,
              costoEstimado: actIA.costo_estimado,
              estado: 'pendiente',
            })),
          });
        }

        await this.presupuestos.recalcularConTx(tx, id_viaje);
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    return this.getItinerario(id_usuario, id_viaje);
  }

  async getItinerario(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const itinerario = await this.prisma.itinerario.findUnique({
      where: { id_viaje },
      include: {
        dias_itinerario: {
          orderBy: { numeroDia: 'asc' },
          include: {
            actividades_itinerario: {
              orderBy: { orden: 'asc' },
              include: {
                lugares: true,
              },
            },
          },
        },
      },
    });

    if (!itinerario)
      throw new NotFoundException('El viaje aún no tiene itinerario generado');
    return itinerario;
  }

  async agregarActividad(
    id_usuario: number,
    id_viaje: number,
    id_dia: number,
    dto: CreateActividadDto,
  ) {
    const itinerario = await this.obtenerItinerarioVerificado(
      id_usuario,
      id_viaje,
    );

    if (!dto.id_lugar && !dto.nombre_lugar) {
      throw new BadRequestException(
        'Debés especificar id_lugar o nombre_lugar',
      );
    }

    // Si es un lugar nuevo (manual), intentamos geolocalizarlo ANTES de la
    // transacción (la llamada de red va afuera de la tx) para que aparezca en
    // el mapa. Si falla, no pasa nada: se guarda sin coordenadas.
    const coordsManual =
      !dto.id_lugar && dto.nombre_lugar
        ? await this.geocoding.geocodificar(
            dto.nombre_lugar,
            dto.ciudad,
            dto.pais,
          )
        : null;

    const horaInicio = dto.hora_inicio
      ? new Date(`1970-01-01T${dto.hora_inicio}:00Z`)
      : null;
    const horaFin = dto.hora_fin
      ? new Date(`1970-01-01T${dto.hora_fin}:00Z`)
      : null;
    if (horaInicio && horaFin && horaFin.getTime() <= horaInicio.getTime()) {
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la de inicio',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const dia = await this.obtenerDia(tx, itinerario.id_itinerario, id_dia);

      const existentes = await tx.actividadItinerario.findMany({
        where: { id_dia_itinerario: id_dia },
        orderBy: { orden: 'asc' },
      });

      // Rechazar si el horario pedido se pisa con otra actividad del día.
      if (horaInicio) {
        const choque = existentes.find((e) =>
          seSolapan(
            horaInicio,
            horaFin,
            e.hora_inicio_estimada,
            e.hora_fin_estimada,
          ),
        );
        if (choque) {
          const rango = choque.hora_fin_estimada
            ? `${horaHHmm(choque.hora_inicio_estimada!)}–${horaHHmm(choque.hora_fin_estimada)}`
            : horaHHmm(choque.hora_inicio_estimada!);
          throw new ConflictException(
            `Ya hay una actividad en ese horario (${rango})`,
          );
        }
      }

      let id_lugar = dto.id_lugar;
      if (id_lugar) {
        const lugarExiste = await tx.lugar.findUnique({ where: { id_lugar } });
        if (!lugarExiste) throw new NotFoundException('Lugar no encontrado');
      } else {
        const nuevoLugar = await tx.lugar.create({
          data: {
            nombre: dto.nombre_lugar!,
            ciudad: dto.ciudad,
            pais: dto.pais,
            categoria: dto.categoria,
            precio_estimado: dto.precio_estimado,
            latitud: coordsManual?.latitud,
            longitud: coordsManual?.longitud,
            fuente_api: 'manual',
          },
        });
        id_lugar = nuevoLugar.id_lugar;
      }

      // Posición: si el usuario no fijó un `orden`, con hora se inserta en el
      // lugar cronológico (antes de la primera actividad más tardía); sin hora,
      // al final.
      let orden = dto.orden;
      if (orden === undefined) {
        const posterior = horaInicio
          ? existentes.find(
              (e) =>
                e.hora_inicio_estimada &&
                e.hora_inicio_estimada.getTime() > horaInicio.getTime(),
            )
          : undefined;
        orden =
          posterior?.orden != null
            ? posterior.orden
            : (existentes.at(-1)?.orden ?? 0) + 1;
      }
      // Abrir el hueco: correr una posición las actividades desde `orden`. Si
      // `orden` cae después de la última, no matchea ninguna (append).
      await tx.actividadItinerario.updateMany({
        where: { id_dia_itinerario: id_dia, orden: { gte: orden } },
        data: { orden: { increment: 1 } },
      });

      const actividad = await tx.actividadItinerario.create({
        data: {
          id_dia_itinerario: id_dia,
          id_lugar,
          orden,
          hora_inicio_estimada: horaInicio ?? undefined,
          hora_fin_estimada: horaFin ?? undefined,
          tipo_actividad: dto.tipo_actividad,
          costoEstimado: dto.costo_estimado,
          estado: 'pendiente',
        },
        include: { lugares: true },
      });

      await this.registrarCambio(
        tx,
        itinerario.id_itinerario,
        'agregar_actividad',
        `Se agregó "${actividad.lugares.nombre}" al día ${dia.numeroDia}`,
      );

      await this.presupuestos.recalcularConTx(tx, id_viaje);

      return actividad;
    });
  }

  async editarActividad(
    id_usuario: number,
    id_viaje: number,
    id_actividad: number,
    dto: UpdateActividadDto,
  ) {
    const itinerario = await this.obtenerItinerarioVerificado(
      id_usuario,
      id_viaje,
    );

    return this.prisma.$transaction(async (tx) => {
      const actividad = await this.obtenerActividad(
        tx,
        itinerario.id_itinerario,
        id_actividad,
      );

      const actualizada = await tx.actividadItinerario.update({
        where: { id_actividad },
        data: {
          ...(dto.tipo_actividad !== undefined && {
            tipo_actividad: dto.tipo_actividad,
          }),
          ...(dto.hora_inicio !== undefined && {
            hora_inicio_estimada: new Date(`1970-01-01T${dto.hora_inicio}:00Z`),
          }),
          ...(dto.hora_fin !== undefined && {
            hora_fin_estimada: new Date(`1970-01-01T${dto.hora_fin}:00Z`),
          }),
          ...(dto.costo_estimado !== undefined && {
            costoEstimado: dto.costo_estimado,
          }),
          ...(dto.estado !== undefined && { estado: dto.estado }),
        },
        include: { lugares: true },
      });

      await this.registrarCambio(
        tx,
        itinerario.id_itinerario,
        'editar_actividad',
        `Se editó "${actividad.lugares.nombre}"`,
      );

      await this.presupuestos.recalcularConTx(tx, id_viaje);

      return actualizada;
    });
  }

  async eliminarActividad(
    id_usuario: number,
    id_viaje: number,
    id_actividad: number,
  ) {
    const itinerario = await this.obtenerItinerarioVerificado(
      id_usuario,
      id_viaje,
    );

    await this.prisma.$transaction(async (tx) => {
      const actividad = await this.obtenerActividad(
        tx,
        itinerario.id_itinerario,
        id_actividad,
      );

      await tx.actividadItinerario.delete({ where: { id_actividad } });

      await tx.actividadItinerario.updateMany({
        where: {
          id_dia_itinerario: actividad.id_dia_itinerario,
          orden: { gt: actividad.orden ?? 0 },
        },
        data: { orden: { decrement: 1 } },
      });

      await this.registrarCambio(
        tx,
        itinerario.id_itinerario,
        'eliminar_actividad',
        `Se eliminó "${actividad.lugares.nombre}" del día ${actividad.dias_itinerario.numeroDia}`,
      );

      await this.presupuestos.recalcularConTx(tx, id_viaje);
    });

    return { message: 'Actividad eliminada correctamente' };
  }

  async moverActividad(
    id_usuario: number,
    id_viaje: number,
    id_actividad: number,
    dto: MoverActividadDto,
  ) {
    const itinerario = await this.obtenerItinerarioVerificado(
      id_usuario,
      id_viaje,
    );

    return this.prisma.$transaction(async (tx) => {
      const actividad = await this.obtenerActividad(
        tx,
        itinerario.id_itinerario,
        id_actividad,
      );
      const diaDestino = await this.obtenerDia(
        tx,
        itinerario.id_itinerario,
        dto.id_dia_destino,
      );

      const diaOrigenId = actividad.id_dia_itinerario;
      const ordenOrigen = actividad.orden ?? 1;

      // Cerrar el hueco en el día de origen
      await tx.actividadItinerario.updateMany({
        where: { id_dia_itinerario: diaOrigenId, orden: { gt: ordenOrigen } },
        data: { orden: { decrement: 1 } },
      });

      let ordenDestino = dto.orden;
      if (ordenDestino === undefined) {
        const ultima = await tx.actividadItinerario.findFirst({
          where: {
            id_dia_itinerario: dto.id_dia_destino,
            id_actividad: { not: id_actividad },
          },
          orderBy: { orden: 'desc' },
        });
        ordenDestino = (ultima?.orden ?? 0) + 1;
      } else {
        await tx.actividadItinerario.updateMany({
          where: {
            id_dia_itinerario: dto.id_dia_destino,
            orden: { gte: ordenDestino },
            id_actividad: { not: id_actividad },
          },
          data: { orden: { increment: 1 } },
        });
      }

      const actualizada = await tx.actividadItinerario.update({
        where: { id_actividad },
        data: { id_dia_itinerario: dto.id_dia_destino, orden: ordenDestino },
        include: { lugares: true },
      });

      const descripcion =
        diaOrigenId === dto.id_dia_destino
          ? `Se reordenó "${actividad.lugares.nombre}" dentro del día ${diaDestino.numeroDia}`
          : `Se movió "${actividad.lugares.nombre}" del día ${actividad.dias_itinerario.numeroDia} al día ${diaDestino.numeroDia}`;

      await this.registrarCambio(
        tx,
        itinerario.id_itinerario,
        'mover_actividad',
        descripcion,
      );

      await this.presupuestos.recalcularConTx(tx, id_viaje);

      return actualizada;
    });
  }

  /**
   * Optimiza el recorrido de un día: reordena las actividades con coordenadas
   * para minimizar los traslados (nearest-neighbor + un pase de 2-opt) y corre
   * los horarios existentes a la nueva secuencia, como "optimizar paradas" de un
   * mapa. Las actividades sin coordenadas quedan al final en su orden actual.
   */
  async optimizarDia(id_usuario: number, id_viaje: number, id_dia: number) {
    const itinerario = await this.obtenerItinerarioVerificado(
      id_usuario,
      id_viaje,
    );

    return this.prisma.$transaction(async (tx) => {
      const dia = await this.obtenerDia(tx, itinerario.id_itinerario, id_dia);

      const actividades = await tx.actividadItinerario.findMany({
        where: { id_dia_itinerario: id_dia },
        orderBy: { orden: 'asc' },
        include: { lugares: true },
      });

      const conCoords = actividades.filter(
        (a) => a.lugares.latitud != null && a.lugares.longitud != null,
      );
      if (conCoords.length < 3) {
        // Con 0-2 paradas ubicadas no hay recorrido que optimizar.
        throw new BadRequestException(
          'Se necesitan al menos 3 actividades con ubicación para optimizar el recorrido',
        );
      }

      // Los "transporte" son traslados entre zonas, no destinos: se geolocalizan
      // de forma ambigua (a veces al centro de la ciudad de origen), así que no
      // se optimizan como paradas; se reinsertan en los límites entre zonas.
      const esTraslado = (a: (typeof actividades)[number]) =>
        a.tipo_actividad === 'transporte';
      const traslados = actividades.filter(esTraslado);
      const sinUbicacion = actividades.filter(
        (a) =>
          !esTraslado(a) &&
          (a.lugares.latitud == null || a.lugares.longitud == null),
      );

      const puntos = actividades
        .filter(
          (a) =>
            !esTraslado(a) &&
            a.lugares.latitud != null &&
            a.lugares.longitud != null,
        )
        .map((a) => ({
          act: a,
          lat: Number(a.lugares.latitud),
          lng: Number(a.lugares.longitud),
        }));

      // Agrupar los destinos por zona, ordenar las zonas (arrancando por la del
      // primer destino) y optimizar el recorrido dentro de cada una.
      const zonas = puntos.length
        ? ordenarClusters(clusterizar(puntos), puntos[0])
        : [];
      const bloques = zonas.map((z) => dosOpt(nearestNeighbor(z)).map((p) => p.act));

      // Armar la secuencia: cada bloque de zona, y en el cruce a la zona siguiente
      // se mete un traslado. Los traslados que sobran (típicamente el "regreso")
      // van al final; las actividades sin ubicación, al final de todo.
      const cola = [...traslados];
      const nuevoOrden: typeof actividades = [];
      bloques.forEach((bloque, i) => {
        nuevoOrden.push(...bloque);
        if (i < bloques.length - 1 && cola.length) {
          nuevoOrden.push(cola.shift()!);
        }
      });
      nuevoOrden.push(...cola, ...sinUbicacion);

      // Los horarios del día son la "plantilla" que se reasigna a la nueva
      // secuencia. Se ordenan de menor a mayor (las actividades sin hora al
      // final) para que el recorrido optimizado quede cronológico: la primera
      // parada con la hora más temprana y sin que una hora más tarde caiga antes
      // de una más temprana.
      const franjas = actividades
        .map((a) => ({
          inicio: a.hora_inicio_estimada,
          fin: a.hora_fin_estimada,
        }))
        .sort((x, y) => {
          if (!x.inicio) return y.inicio ? 1 : 0;
          if (!y.inicio) return -1;
          return x.inicio.getTime() - y.inicio.getTime();
        });

      // Sin cambios sólo si cada posición queda igual: misma actividad Y misma
      // hora. Así también reordena los horarios cuando el orden espacial ya era
      // óptimo pero las horas estaban desordenadas (p. ej. tras arrastrar a mano).
      const t = (d: Date | null) => d?.getTime() ?? null;
      const sinCambios = nuevoOrden.every(
        (a, i) =>
          a.id_actividad === actividades[i].id_actividad &&
          t(a.hora_inicio_estimada) === t(franjas[i].inicio),
      );
      if (sinCambios) {
        return { optimizada: false, actividades };
      }

      for (let i = 0; i < nuevoOrden.length; i++) {
        await tx.actividadItinerario.update({
          where: { id_actividad: nuevoOrden[i].id_actividad },
          data: {
            orden: i + 1,
            hora_inicio_estimada: franjas[i].inicio,
            hora_fin_estimada: franjas[i].fin,
          },
        });
      }

      await this.registrarCambio(
        tx,
        itinerario.id_itinerario,
        'optimizar_dia',
        `Se optimizó el recorrido del día ${dia.numeroDia}`,
      );

      const actualizadas = await tx.actividadItinerario.findMany({
        where: { id_dia_itinerario: id_dia },
        orderBy: { orden: 'asc' },
        include: { lugares: true },
      });
      return { optimizada: true, actividades: actualizadas };
    });
  }

  async getHistorialCambios(id_usuario: number, id_viaje: number) {
    const itinerario = await this.obtenerItinerarioVerificado(
      id_usuario,
      id_viaje,
    );

    return this.prisma.cambioItinerario.findMany({
      where: { id_itinerario: itinerario.id_itinerario },
      orderBy: { fecha_cambio: 'desc' },
    });
  }

  /**
   * Geocodifica (Nominatim) los lugares del itinerario que todavía no tienen
   * coordenadas, para que aparezcan en el mapa. Procesa en lotes chicos para
   * ser respetuoso con la API pública. Devuelve cuántos se ubicaron.
   */
  async geocodificarFaltantes(id_usuario: number, id_viaje: number) {
    const itinerario = await this.obtenerItinerarioVerificado(
      id_usuario,
      id_viaje,
    );

    const actividades = await this.prisma.actividadItinerario.findMany({
      where: { dias_itinerario: { id_itinerario: itinerario.id_itinerario } },
      include: { lugares: true },
    });

    // Lugares únicos sin coordenadas.
    const pendientes = new Map<
      number,
      (typeof actividades)[number]['lugares']
    >();
    for (const act of actividades) {
      const l = act.lugares;
      if (l.latitud == null || l.longitud == null) {
        pendientes.set(l.id_lugar, l);
      }
    }
    const lugares = [...pendientes.values()];

    let ubicados = 0;
    const LOTE = 3;
    for (let i = 0; i < lugares.length; i += LOTE) {
      const lote = lugares.slice(i, i + LOTE);
      const coords = await Promise.all(
        lote.map((l) =>
          this.geocoding.geocodificar(l.nombre, l.ciudad, l.pais),
        ),
      );
      await Promise.all(
        coords.map((c, j) => {
          if (!c) return null;
          ubicados++;
          return this.prisma.lugar.update({
            where: { id_lugar: lote[j].id_lugar },
            data: { latitud: c.latitud, longitud: c.longitud },
          });
        }),
      );
      // Pausa entre lotes para no abusar de la API pública de Nominatim.
      if (i + LOTE < lugares.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return { total: lugares.length, ubicados };
  }

  private async obtenerItinerarioVerificado(
    id_usuario: number,
    id_viaje: number,
  ) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const itinerario = await this.prisma.itinerario.findUnique({
      where: { id_viaje },
    });
    if (!itinerario)
      throw new NotFoundException('El viaje aún no tiene itinerario generado');

    return itinerario;
  }

  private async obtenerDia(tx: Tx, id_itinerario: number, id_dia: number) {
    const dia = await tx.diaItinerario.findUnique({
      where: { id_dia_itinerario: id_dia },
    });
    if (!dia || dia.id_itinerario !== id_itinerario) {
      throw new NotFoundException('Día no encontrado en este itinerario');
    }
    return dia;
  }

  private async obtenerActividad(
    tx: Tx,
    id_itinerario: number,
    id_actividad: number,
  ) {
    const actividad = await tx.actividadItinerario.findUnique({
      where: { id_actividad },
      include: { dias_itinerario: true, lugares: true },
    });
    if (
      !actividad ||
      actividad.dias_itinerario.id_itinerario !== id_itinerario
    ) {
      throw new NotFoundException('Actividad no encontrada en este itinerario');
    }
    return actividad;
  }

  private async registrarCambio(
    tx: Tx,
    id_itinerario: number,
    tipo_cambio: string,
    descripcion: string,
  ) {
    await tx.cambioItinerario.create({
      data: {
        id_itinerario,
        tipo_cambio,
        descripcion,
        fecha_cambio: new Date(),
      },
    });
  }
}
