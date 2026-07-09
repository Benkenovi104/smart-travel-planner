import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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

    return this.prisma.$transaction(async (tx) => {
      const dia = await this.obtenerDia(tx, itinerario.id_itinerario, id_dia);

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

      let orden = dto.orden;
      if (orden === undefined) {
        const ultima = await tx.actividadItinerario.findFirst({
          where: { id_dia_itinerario: id_dia },
          orderBy: { orden: 'desc' },
        });
        orden = (ultima?.orden ?? 0) + 1;
      } else {
        await tx.actividadItinerario.updateMany({
          where: { id_dia_itinerario: id_dia, orden: { gte: orden } },
          data: { orden: { increment: 1 } },
        });
      }

      const actividad = await tx.actividadItinerario.create({
        data: {
          id_dia_itinerario: id_dia,
          id_lugar,
          orden,
          hora_inicio_estimada: dto.hora_inicio
            ? new Date(`1970-01-01T${dto.hora_inicio}:00Z`)
            : undefined,
          hora_fin_estimada: dto.hora_fin
            ? new Date(`1970-01-01T${dto.hora_fin}:00Z`)
            : undefined,
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
