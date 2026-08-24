import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingService, habitacionesPara } from './booking.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';
import { GooglePlacesService } from '../lugares/google-places.service.js';
import { GeminiService } from '../itinerarios/gemini.service.js';

const MAX_OPCIONES = 5;

@Injectable()
export class AlojamientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: BookingService,
    private readonly presupuestos: PresupuestosService,
    private readonly googlePlaces: GooglePlacesService,
    private readonly gemini: GeminiService,
  ) {}

  async buscarYGuardar(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const perfil = await this.prisma.perfilViajero.findUnique({
      where: { id_usuario },
    });

    const noches = Math.max(
      1,
      Math.round(
        (viaje.fechaFin.getTime() - viaje.fechaInicio.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    let opciones: Array<{
      id_viaje: number;
      nombre: string;
      tipo?: string;
      direccion?: string | null;
      precio_por_noche: number;
      rating?: number | null;
      latitud?: number | null;
      longitud?: number | null;
      url_referencia?: string | null;
    }> = [];

    // 1. Intentamos buscar con Google Places API (New) + Gemini IA
    const hotelesGoogle = await this.googlePlaces.buscarAlojamientosGoogle(
      viaje.destino_principal,
      8,
    );

    if (hotelesGoogle && hotelesGoogle.length > 0) {
      const recomendacionesIA = await this.gemini.sugerirAlojamientos({
        destino: viaje.destino_principal,
        presupuestoTotal: viaje.presupuestoTotal
          ? Number(viaje.presupuestoTotal)
          : undefined,
        cantidadPersonas: viaje.cantidadPersonas ?? 1,
        ritmoPreferido: perfil?.ritmoPreferido,
        presupuestoPreferido: perfil?.presupuesto_preferido,
        hotelesDisponibles: hotelesGoogle.map((h) => ({
          id: h.id,
          nombre: h.nombre,
          direccion: h.direccion,
          rating: h.rating,
          userRatingCount: h.userRatingCount,
        })),
      });

      const mapRecomendaciones = new Map(
        recomendacionesIA.map((r) => [r.id, r]),
      );

      // Seleccionamos los recomendados por IA o los de mayor rating
      const seleccionados = hotelesGoogle.slice(0, MAX_OPCIONES);

      opciones = seleccionados.map((h) => {
        const rec = mapRecomendaciones.get(h.id);
        const precioEstimado = rec?.precioEstimadoPorNoche ?? 120;

        const metadata = {
          url: h.websiteUri || h.googleMapsUri || null,
          fotoUrl: h.fotoUrl || null,
          fotos: h.fotos || [],
          razon:
            rec?.razonRecomendacion ||
            `Excelente hospedaje con alta puntuación en ${viaje.destino_principal}.`,
        };

        return {
          id_viaje,
          nombre: h.nombre,
          tipo: 'Hotel',
          direccion: h.direccion,
          precio_por_noche: precioEstimado,
          rating: h.rating,
          latitud: h.latitud,
          longitud: h.longitud,
          url_referencia: JSON.stringify(metadata),
        };
      });
    }

    // 2. Fallback a Booking API si Google Places no devolvió resultados
    if (opciones.length === 0) {
      const destino = await this.booking.resolverDestino(
        viaje.destino_principal,
      );
      if (destino) {
        const fechaEntrada = viaje.fechaInicio.toISOString().split('T')[0];
        const fechaSalida = viaje.fechaFin.toISOString().split('T')[0];
        const personas = viaje.cantidadPersonas ?? 1;

        const hoteles = await this.booking.buscarHoteles({
          destino,
          fechaEntrada,
          fechaSalida,
          adultos: personas,
          habitaciones: habitacionesPara(personas),
        });

        const ordenados = [...hoteles].sort(
          (a, b) => a.precioTotal / noches - b.precioTotal / noches,
        );

        opciones = ordenados.slice(0, MAX_OPCIONES).map((h) => ({
          id_viaje,
          nombre: h.nombre,
          tipo: 'Hotel',
          precio_por_noche: h.precioTotal / noches,
          rating: h.rating,
          latitud: h.latitud,
          longitud: h.longitud,
        }));
      }
    }

    if (opciones.length === 0) {
      throw new BadRequestException(
        'No se pudieron encontrar opciones de alojamiento para este viaje.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.opcionAlojamiento.deleteMany({ where: { id_viaje } });
      if (opciones.length > 0) {
        await tx.opcionAlojamiento.createMany({ data: opciones });
      }
      await this.presupuestos.recalcularConTx(tx, id_viaje);
    });

    return this.listar(id_usuario, id_viaje);
  }

  async seleccionar(
    id_usuario: number,
    id_viaje: number,
    id_alojamiento: number,
    seleccionado: boolean,
  ) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const opcion = await this.prisma.opcionAlojamiento.findUnique({
      where: { id_alojamiento },
    });
    if (!opcion || opcion.id_viaje !== id_viaje) {
      throw new NotFoundException('Opción de alojamiento no encontrada');
    }

    await this.prisma.$transaction(async (tx) => {
      if (seleccionado) {
        await tx.opcionAlojamiento.updateMany({
          where: { id_viaje, seleccionado: true },
          data: { seleccionado: false },
        });
      }
      await tx.opcionAlojamiento.update({
        where: { id_alojamiento },
        data: { seleccionado },
      });
      await this.presupuestos.recalcularConTx(tx, id_viaje);
    });

    return this.listar(id_usuario, id_viaje);
  }

  async listar(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    return this.prisma.opcionAlojamiento.findMany({
      where: { id_viaje },
      orderBy: { precio_por_noche: 'asc' },
    });
  }
}
