import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingService } from './booking.service.js';

const MAX_OPCIONES = 5;

@Injectable()
export class AlojamientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: BookingService,
  ) {}

  async buscarYGuardar(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const destino = await this.booking.resolverDestino(viaje.destino_principal);
    if (!destino) {
      throw new BadRequestException(
        'No se pudo resolver el destino para buscar alojamiento',
      );
    }

    const fechaEntrada = viaje.fechaInicio.toISOString().split('T')[0];
    const fechaSalida = viaje.fechaFin.toISOString().split('T')[0];
    const noches = Math.max(
      1,
      Math.round(
        (viaje.fechaFin.getTime() - viaje.fechaInicio.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    const hoteles = await this.booking.buscarHoteles({
      destino,
      fechaEntrada,
      fechaSalida,
      adultos: viaje.cantidadPersonas ?? 1,
    });

    // Rankeamos por precio por noche ascendente (criterio: ajuste al presupuesto).
    const ordenados = [...hoteles].sort(
      (a, b) => a.precioTotal / noches - b.precioTotal / noches,
    );

    const opciones = ordenados.slice(0, MAX_OPCIONES).map((h) => ({
      id_viaje,
      nombre: h.nombre,
      precio_por_noche: h.precioTotal / noches,
      rating: h.rating,
      latitud: h.latitud,
      longitud: h.longitud,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.opcionAlojamiento.deleteMany({ where: { id_viaje } });
      if (opciones.length > 0) {
        await tx.opcionAlojamiento.createMany({ data: opciones });
      }
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
