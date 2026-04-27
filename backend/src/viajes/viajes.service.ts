import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateViajeDto } from './dto/create-viaje.dto.js';
import { UpdateViajeDto } from './dto/update-viaje.dto.js';

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
  constructor(private readonly prisma: PrismaService) {}

  async create(id_usuario: number, dto: CreateViajeDto) {
    const { intereses, ...data } = dto;

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
    await this.findOne(id_usuario, id_viaje);

    const { intereses, ...data } = dto;

    return this.prisma.viaje.update({
      where: { id_viaje },
      data: {
        ...(data.origen && { origen: data.origen }),
        ...(data.destino_principal && { destino_principal: data.destino_principal }),
        ...(data.fecha_inicio && { fechaInicio: new Date(data.fecha_inicio) }),
        ...(data.fecha_fin && { fechaFin: new Date(data.fecha_fin) }),
        ...(data.cantidad_personas !== undefined && { cantidadPersonas: data.cantidad_personas }),
        ...(data.presupuesto_total !== undefined && { presupuestoTotal: data.presupuesto_total }),
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
  }

  async remove(id_usuario: number, id_viaje: number) {
    await this.findOne(id_usuario, id_viaje);

    await this.prisma.viaje.delete({ where: { id_viaje } });
    return { message: 'Viaje eliminado correctamente' };
  }
}
