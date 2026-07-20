import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SavePerfilDto } from './dto/save-perfil.dto.js';

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerPerfil(idUsuario: number) {
    const perfil = await this.prisma.perfilViajero.findUnique({
      where: { id_usuario: idUsuario },
      include: {
        usuarios: {
          select: {
            usuario_intereses: {
              select: {
                prioridad: true,
                intereses: {
                  select: { id_interes: true, nombre: true },
                },
              },
            },
          },
        },
      },
    });

    if (!perfil) {
      return { completado: false };
    }

    const intereses = perfil.usuarios.usuario_intereses.map(
      (ui) => ui.intereses,
    );

    return {
      idPerfil: perfil.id_perfil,
      idUsuario: perfil.id_usuario,
      ritmoPreferido: perfil.ritmoPreferido,
      presupuestoPreferido: perfil.presupuesto_preferido,
      dietas: perfil.dietas,
      movilidad: perfil.movilidad,
      completado: perfil.completado,
      intereses,
    };
  }

  async guardarPerfil(idUsuario: number, dto: SavePerfilDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Upsert en perfil_viajero
      const perfilActualizado = await tx.perfilViajero.upsert({
        where: { id_usuario: idUsuario },
        create: {
          id_usuario: idUsuario,
          ritmoPreferido: dto.ritmoPreferido,
          presupuesto_preferido: dto.presupuestoPreferido,
          dietas: dto.dietas ?? [],
          movilidad: dto.movilidad ?? [],
          completado: true,
        },
        update: {
          ritmoPreferido: dto.ritmoPreferido,
          presupuesto_preferido: dto.presupuestoPreferido,
          dietas: dto.dietas ?? [],
          movilidad: dto.movilidad ?? [],
          completado: true,
        },
      });

      // 2. Eliminar intereses previos del usuario
      await tx.usuarioInteres.deleteMany({
        where: { id_usuario: idUsuario },
      });

      // 3. Insertar los nuevos intereses
      if (dto.interesesIds && dto.interesesIds.length > 0) {
        await tx.usuarioInteres.createMany({
          data: dto.interesesIds.map((idInteres) => ({
            id_usuario: idUsuario,
            id_interes: idInteres,
            prioridad: 1,
          })),
        });
      }

      // 4. Obtener intereses guardados para retornar objeto completo
      const interesesGuardados = await tx.usuarioInteres.findMany({
        where: { id_usuario: idUsuario },
        select: {
          intereses: { select: { id_interes: true, nombre: true } },
        },
      });

      return {
        idPerfil: perfilActualizado.id_perfil,
        idUsuario: perfilActualizado.id_usuario,
        ritmoPreferido: perfilActualizado.ritmoPreferido,
        presupuestoPreferido: perfilActualizado.presupuesto_preferido,
        dietas: perfilActualizado.dietas,
        movilidad: perfilActualizado.movilidad,
        completado: perfilActualizado.completado,
        intereses: interesesGuardados.map((ui) => ui.intereses),
      };
    });
  }

  async obtenerEstadoOnboarding(idUsuario: number) {
    const perfil = await this.prisma.perfilViajero.findUnique({
      where: { id_usuario: idUsuario },
      select: { completado: true },
    });

    return { completado: perfil?.completado ?? false };
  }
}
