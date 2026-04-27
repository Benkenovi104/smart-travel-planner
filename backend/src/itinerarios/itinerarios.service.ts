import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeminiService } from './gemini.service.js';

@Injectable()
export class ItinerariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
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

    // Borrar itinerario previo si existe
    const itinerarioPrevio = await this.prisma.itinerario.findUnique({
      where: { id_viaje },
    });
    if (itinerarioPrevio) {
      await this.prisma.itinerario.delete({ where: { id_viaje } });
    }

    // Preparar parámetros para la IA
    const intereses = viaje.viaje_intereses.map((vi) => vi.intereses.nombre);
    const perfil = viaje.usuarios.perfil_viajero;

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
    });

    // Crear lugares (sin transacción, son datos reutilizables)
    const lugaresMap = new Map<string, number>();
    for (const diaIA of itinerarioIA.dias) {
      for (const actIA of diaIA.actividades) {
        const key = `${actIA.nombre_lugar}|${actIA.ciudad}`;
        if (!lugaresMap.has(key)) {
          const lugar = await this.prisma.lugar.create({
            data: {
              nombre: actIA.nombre_lugar,
              ciudad: actIA.ciudad,
              pais: actIA.pais,
              categoria: actIA.categoria,
              precio_estimado: actIA.costo_estimado,
              duracionEstimadaMin: actIA.duracion_minutos,
              fuente_api: 'gemini',
            },
          });
          lugaresMap.set(key, lugar.id_lugar);
        }
      }
    }

    // Crear itinerario
    const nuevoItinerario = await this.prisma.itinerario.create({
      data: { id_viaje, fecha_generacion: new Date(), tipo_generacion: 'ai' },
    });

    // Crear días y actividades secuencialmente (sin transacción)
    for (const diaIA of itinerarioIA.dias) {
      const dia = await this.prisma.diaItinerario.create({
        data: {
          id_itinerario: nuevoItinerario.id_itinerario,
          numeroDia: diaIA.numero_dia,
          fecha: new Date(diaIA.fecha),
          costo_estimado_dia: diaIA.costo_estimado_dia,
        },
      });

      await this.prisma.actividadItinerario.createMany({
        data: diaIA.actividades.map((actIA, idx) => ({
          id_dia_itinerario: dia.id_dia_itinerario,
          id_lugar: lugaresMap.get(`${actIA.nombre_lugar}|${actIA.ciudad}`)!,
          orden: idx + 1,
          hora_inicio_estimada: actIA.hora_inicio
            ? new Date(`1970-01-01T${actIA.hora_inicio}:00`)
            : undefined,
          hora_fin_estimada: actIA.hora_fin
            ? new Date(`1970-01-01T${actIA.hora_fin}:00`)
            : undefined,
          tipo_actividad: actIA.tipo_actividad,
          costoEstimado: actIA.costo_estimado,
          estado: 'pendiente',
        })),
      });
    }

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

    if (!itinerario) throw new NotFoundException('El viaje aún no tiene itinerario generado');
    return itinerario;
  }
}
