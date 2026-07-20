import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { ViajesService } from '../viajes/viajes.service.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import { UpsertPerfilDto } from './dto/upsert-perfil.dto.js';
import { AddInteresDto } from './dto/add-interes.dto.js';
import { RitmoViaje, NivelPresupuesto } from '../../generated/prisma/enums.js';

function mapRitmoVal(ritmo?: string): RitmoViaje | undefined {
  if (!ritmo) return undefined;
  const val = ritmo.toUpperCase();
  if (val === 'RELAJADO' || val === 'RELAX') return RitmoViaje.RELAX;
  if (val === 'MODERADO' || val === 'EQUILIBRADO')
    return RitmoViaje.EQUILIBRADO;
  if (val === 'INTENSO' || val === 'MARATONICO') return RitmoViaje.MARATONICO;
  return undefined;
}

function mapPresupuestoVal(presupuesto?: string): NivelPresupuesto | undefined {
  if (!presupuesto) return undefined;
  const val = presupuesto.toUpperCase();
  if (val === 'ECONÓMICO' || val === 'ECONOMIC' || val === 'ECONOMICO')
    return NivelPresupuesto.ECONOMICO;
  if (val === 'MODERADO' || val === 'CONFORT') return NivelPresupuesto.CONFORT;
  if (val === 'PREMIUM' || val === 'LUJO') return NivelPresupuesto.PREMIUM;
  return undefined;
}

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
    const ritmo = mapRitmoVal(dto.ritmo_preferido);
    const presupuesto = mapPresupuestoVal(dto.presupuesto_preferido);

    return this.prisma.perfilViajero.upsert({
      where: { id_usuario },
      create: {
        id_usuario,
        ...(ritmo && { ritmoPreferido: ritmo }),
        ...(presupuesto && { presupuesto_preferido: presupuesto }),
        tipoViajero: dto.tipo_viajero,
      },
      update: {
        ...(ritmo !== undefined && { ritmoPreferido: ritmo }),
        ...(presupuesto !== undefined && {
          presupuesto_preferido: presupuesto,
        }),
        ...(dto.tipo_viajero !== undefined && {
          tipoViajero: dto.tipo_viajero,
        }),
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
      where: {
        id_usuario_id_interes: { id_usuario, id_interes: dto.id_interes },
      },
    });
    if (yaAgregado) throw new ConflictException('El interés ya está agregado');

    return this.prisma.usuarioInteres.create({
      data: {
        id_usuario,
        id_interes: dto.id_interes,
        prioridad: dto.prioridad,
      },
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

  async deleteMe(id_usuario: number, password: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario },
      select: { id_usuario: true, password_hash: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // Confirmación con la contraseña actual: el borrado de cuenta es
    // irreversible, no alcanza con estar autenticado.
    const passwordOk = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordOk) throw new UnauthorizedException('Contraseña incorrecta');

    // Cascade manual completo (el schema usa onDelete: NoAction): primero los
    // viajes con todos sus hijos, después perfil e intereses, y al final el
    // usuario. Todo en una transacción para no dejar la cuenta a medio borrar.
    await this.prisma.$transaction(async (tx) => {
      const viajes = await tx.viaje.findMany({
        where: { id_usuario },
        select: { id_viaje: true },
      });
      for (const { id_viaje } of viajes) {
        await ViajesService.cascadeDeleteEnTx(tx, id_viaje);
      }

      await tx.perfilViajero.deleteMany({ where: { id_usuario } });
      await tx.usuarioInteres.deleteMany({ where: { id_usuario } });
      await tx.usuario.delete({ where: { id_usuario } });
    });

    return { message: 'Cuenta eliminada correctamente' };
  }
}
