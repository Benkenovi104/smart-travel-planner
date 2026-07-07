import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from './usuarios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ViajesService } from '../viajes/viajes.service.js';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      usuario: { findUnique: jest.fn(), delete: jest.fn() },
      interes: { findUnique: jest.fn() },
      usuarioInteres: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('deleteMe', () => {
    it('lanza Unauthorized si la contraseña no coincide', async () => {
      const hash = await bcrypt.hash('correcta', 4);
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 1,
        password_hash: hash,
      });
      await expect(service.deleteMe(1, 'incorrecta')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('con password correcta borra viajes (cascade), perfil, intereses y usuario', async () => {
      const hash = await bcrypt.hash('correcta', 4);
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 1,
        password_hash: hash,
      });

      const tx = {
        viaje: { findMany: jest.fn(async () => [{ id_viaje: 10 }, { id_viaje: 11 }]) },
        perfilViajero: { deleteMany: jest.fn() },
        usuarioInteres: { deleteMany: jest.fn() },
        usuario: { delete: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
      const cascadeSpy = jest
        .spyOn(ViajesService, 'cascadeDeleteEnTx')
        .mockResolvedValue(undefined);

      const res = await service.deleteMe(1, 'correcta');
      expect(res.message).toMatch(/eliminada/i);
      // un cascade por cada viaje
      expect(cascadeSpy).toHaveBeenCalledTimes(2);
      expect(cascadeSpy).toHaveBeenCalledWith(tx, 10);
      expect(cascadeSpy).toHaveBeenCalledWith(tx, 11);
      expect(tx.perfilViajero.deleteMany).toHaveBeenCalledWith({
        where: { id_usuario: 1 },
      });
      expect(tx.usuarioInteres.deleteMany).toHaveBeenCalledWith({
        where: { id_usuario: 1 },
      });
      expect(tx.usuario.delete).toHaveBeenCalledWith({
        where: { id_usuario: 1 },
      });
    });
  });

  describe('addInteres', () => {
    it('lanza NotFound si el interés no existe en el catálogo', async () => {
      prisma.interes.findUnique.mockResolvedValue(null);
      await expect(
        service.addInteres(1, { id_interes: 999 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lanza Conflict si el interés ya está agregado', async () => {
      prisma.interes.findUnique.mockResolvedValue({ id_interes: 3 });
      prisma.usuarioInteres.findUnique.mockResolvedValue({ id_interes: 3 });
      await expect(
        service.addInteres(1, { id_interes: 3 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.usuarioInteres.create).not.toHaveBeenCalled();
    });
  });

  describe('removeInteres', () => {
    it('lanza NotFound si el usuario no tiene ese interés', async () => {
      prisma.usuarioInteres.findUnique.mockResolvedValue(null);
      await expect(service.removeInteres(1, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
