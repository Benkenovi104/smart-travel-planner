import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import { UpsertPerfilDto } from './dto/upsert-perfil.dto.js';
import { AddInteresDto } from './dto/add-interes.dto.js';

const USUARIO_SELECT = {
  id_usuario: true,
  nombre: true,
  apellido: true,
  email: true,
  fecha_registro: true,
  perfil_viajero: {
    select: {
      ritmoPreferido: true,
      presupuesto_preferido: true,
      tipoViajero: true,
    },
  },
  usuario_intereses: {
    select: {
      prioridad: true,
      intereses: { select: { id_interes: true, nombre: true } },
    },
  },
};

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(id_usuario: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario },
      select: USUARIO_SELECT,
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async updateMe(id_usuario: number, dto: UpdateUsuarioDto) {
    return this.prisma.usuario.update({
      where: { id_usuario },
      data: dto,
      select: USUARIO_SELECT,
    });
  }

  async upsertPerfil(id_usuario: number, dto: UpsertPerfilDto) {
    return this.prisma.perfilViajero.upsert({
      where: { id_usuario },
      create: {
        id_usuario,
        ritmoPreferido: dto.ritmo_preferido,
        presupuesto_preferido: dto.presupuesto_preferido,
        tipoViajero: dto.tipo_viajero,
      },
      update: {
        ...(dto.ritmo_preferido !== undefined && { ritmoPreferido: dto.ritmo_preferido }),
        ...(dto.presupuesto_preferido !== undefined && { presupuesto_preferido: dto.presupuesto_preferido }),
        ...(dto.tipo_viajero !== undefined && { tipoViajero: dto.tipo_viajero }),
      },
      select: {
        ritmoPreferido: true,
        presupuesto_preferido: true,
        tipoViajero: true,
      },
    });
  }

  async getIntereses(id_usuario: number) {
    return this.prisma.usuarioInteres.findMany({
      where: { id_usuario },
      select: {
        prioridad: true,
        intereses: { select: { id_interes: true, nombre: true } },
      },
    });
  }

  async addInteres(id_usuario: number, dto: AddInteresDto) {
    const existe = await this.prisma.interes.findUnique({
      where: { id_interes: dto.id_interes },
    });
    if (!existe) throw new NotFoundException('Interés no encontrado');

    const yaAgregado = await this.prisma.usuarioInteres.findUnique({
      where: { id_usuario_id_interes: { id_usuario, id_interes: dto.id_interes } },
    });
    if (yaAgregado) throw new ConflictException('El interés ya está agregado');

    return this.prisma.usuarioInteres.create({
      data: { id_usuario, id_interes: dto.id_interes, prioridad: dto.prioridad },
      select: {
        prioridad: true,
        intereses: { select: { id_interes: true, nombre: true } },
      },
    });
  }

  async removeInteres(id_usuario: number, id_interes: number) {
    const existe = await this.prisma.usuarioInteres.findUnique({
      where: { id_usuario_id_interes: { id_usuario, id_interes } },
    });
    if (!existe) throw new NotFoundException('El usuario no tiene ese interés');

    await this.prisma.usuarioInteres.delete({
      where: { id_usuario_id_interes: { id_usuario, id_interes } },
    });
    return { message: 'Interés eliminado correctamente' };
  }

  async getAllIntereses() {
    return this.prisma.interes.findMany({
      select: { id_interes: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
