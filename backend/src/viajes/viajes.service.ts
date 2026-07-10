import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateViajeDto } from './dto/create-viaje.dto.js';
import { UpdateViajeDto } from './dto/update-viaje.dto.js';

type Tx = Prisma.TransactionClient;

const VIAJE_SELECT = {
  id_viaje: true,
  origen: true,
  destino_principal: true,
  fechaInicio: true,
  fechaFin: true,
  cantidadPersonas: true,
  presupuestoTotal: true,
  estado: true,
  fecha_creacion: true,
  viaje_intereses: {
    select: {
      prioridad: true,
      intereses: { select: { id_interes: true, nombre: true } },
    },
  },
};

@Injectable()
export class ViajesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presupuestos: PresupuestosService,
  ) {}

  async create(id_usuario: number, dto: CreateViajeDto) {
    const { intereses, ...data } = dto;

    if (new Date(data.fecha_fin) < new Date(data.fecha_inicio)) {
      throw new BadRequestException(
        'La fecha de fin debe ser igual o posterior a la de inicio',
      );
    }

    return this.prisma.viaje.create({
      data: {
        id_usuario,
        origen: data.origen,
        destino_principal: data.destino_principal,
        fechaInicio: new Date(data.fecha_inicio),
        fechaFin: new Date(data.fecha_fin),
        cantidadPersonas: data.cantidad_personas,
        presupuestoTotal: data.presupuesto_total,
        estado: 'planificado',
        fecha_creacion: new Date(),
        ...(intereses?.length && {
          viaje_intereses: {
            create: intereses.map((id_interes) => ({ id_interes })),
          },
        }),
      },
      select: VIAJE_SELECT,
    });
  }

  async findAll(id_usuario: number) {
    return this.prisma.viaje.findMany({
      where: { id_usuario },
      select: VIAJE_SELECT,
      orderBy: { fecha_creacion: 'desc' },
    });
  }

  async findOne(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({
      where: { id_viaje },
      select: { id_usuario: true, ...VIAJE_SELECT },
    });

    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    return viaje;
  }

  async update(id_usuario: number, id_viaje: number, dto: UpdateViajeDto) {
    const actual = await this.findOne(id_usuario, id_viaje);

    const { intereses, ...data } = dto;

    // Las fechas se validan contra las que van a quedar, no sólo contra las que
    // vienen en el DTO: mandar sólo `fecha_fin` también puede invertir el rango.
    const fechaInicio = data.fecha_inicio
      ? new Date(data.fecha_inicio)
      : actual.fechaInicio;
    const fechaFin = data.fecha_fin ? new Date(data.fecha_fin) : actual.fechaFin;

    if (fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser igual o posterior a la de inicio',
      );
    }

    // Cambiar las fechas cambia la cantidad de noches, y `monto_alojamiento`
    // está persistido en la tabla `presupuestos`: sin recalcular quedaría
    // desfasado hasta la próxima edición del itinerario.
    const cambianLasFechas =
      fechaInicio.getTime() !== actual.fechaInicio.getTime() ||
      fechaFin.getTime() !== actual.fechaFin.getTime();

    return this.prisma.$transaction(async (tx) => {
      const viaje = await tx.viaje.update({
        where: { id_viaje },
        data: {
          ...(data.origen && { origen: data.origen }),
          ...(data.destino_principal && {
            destino_principal: data.destino_principal,
          }),
          ...(data.fecha_inicio && { fechaInicio }),
          ...(data.fecha_fin && { fechaFin }),
          ...(data.cantidad_personas !== undefined && {
            cantidadPersonas: data.cantidad_personas,
          }),
          ...(data.presupuesto_total !== undefined && {
            presupuestoTotal: data.presupuesto_total,
          }),
          ...(data.estado && { estado: data.estado }),
          ...(intereses && {
            viaje_intereses: {
              deleteMany: {},
              create: intereses.map((id_interes) => ({ id_interes })),
            },
          }),
        },
        select: VIAJE_SELECT,
      });

      if (cambianLasFechas) {
        await this.presupuestos.recalcularConTx(tx, id_viaje);
      }

      return viaje;
    });
  }

  async remove(id_usuario: number, id_viaje: number) {
    await this.findOne(id_usuario, id_viaje);

    await this.prisma.$transaction((tx) =>
      ViajesService.cascadeDeleteEnTx(tx, id_viaje),
    );

    return { message: 'Viaje eliminado correctamente' };
  }

  /**
   * Borra un viaje y TODAS sus tablas dependientes dentro de una transacción
   * ya abierta. Cascade manual: el schema usa `onDelete: NoAction`, así que hay
   * que borrar los hijos antes que el padre. No valida ownership (lo hace quien
   * llama). Reutilizado por `remove` y por el borrado de cuenta del usuario.
   */
  static async cascadeDeleteEnTx(tx: Tx, id_viaje: number): Promise<void> {
    const itinerario = await tx.itinerario.findUnique({ where: { id_viaje } });
    if (itinerario) {
      await tx.actividadItinerario.deleteMany({
        where: { dias_itinerario: { id_itinerario: itinerario.id_itinerario } },
      });
      await tx.diaItinerario.deleteMany({
        where: { id_itinerario: itinerario.id_itinerario },
      });
      await tx.cambioItinerario.deleteMany({
        where: { id_itinerario: itinerario.id_itinerario },
      });
      await tx.itinerario.delete({ where: { id_viaje } });
    }

    await tx.gastoEstimado.deleteMany({ where: { id_viaje } });
    await tx.presupuesto.deleteMany({ where: { id_viaje } });
    await tx.opcionVuelo.deleteMany({ where: { id_viaje } });
    await tx.opcionAlojamiento.deleteMany({ where: { id_viaje } });
    await tx.viajeInteres.deleteMany({ where: { id_viaje } });

    await tx.viaje.delete({ where: { id_viaje } });
  }
}
