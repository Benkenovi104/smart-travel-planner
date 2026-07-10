import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingService, habitacionesPara } from './booking.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';

const MAX_OPCIONES = 5;

@Injectable()
export class AlojamientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: BookingService,
    private readonly presupuestos: PresupuestosService,
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

    const personas = viaje.cantidadPersonas ?? 1;

    const hoteles = await this.booking.buscarHoteles({
      destino,
      fechaEntrada,
      fechaSalida,
      adultos: personas,
      habitaciones: habitacionesPara(personas),
    });

    // Rankeamos por precio por noche ascendente (criterio: ajuste al presupuesto).
    const ordenados = [...hoteles].sort(
      (a, b) => a.precioTotal / noches - b.precioTotal / noches,
    );

    // `precioTotal` es la estadía completa para todo el grupo, así que dividir por
    // noches deja un precio por noche ya prorrateado: no se multiplica por personas.
    const opciones = ordenados.slice(0, MAX_OPCIONES).map((h) => ({
      id_viaje,
      nombre: h.nombre,
      precio_por_noche: h.precioTotal / noches,
      rating: h.rating,
      latitud: h.latitud,
      longitud: h.longitud,
    }));

    await this.prisma.$transaction(async (tx) => {
      // Reemplazar las opciones descarta la que estuviera seleccionada, así que
      // el presupuesto tiene que volver a calcularse sin ese alojamiento.
      await tx.opcionAlojamiento.deleteMany({ where: { id_viaje } });
      if (opciones.length > 0) {
        await tx.opcionAlojamiento.createMany({ data: opciones });
      }
      await this.presupuestos.recalcularConTx(tx, id_viaje);
    });

    return this.listar(id_usuario, id_viaje);
  }

  /**
   * Elige (o descarta) una opción de alojamiento. La selección es exclusiva por
   * viaje y dispara el recálculo del presupuesto, que suma `precio_por_noche`
   * multiplicado por las noches del viaje.
   */
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
