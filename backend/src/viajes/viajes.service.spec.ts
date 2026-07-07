import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { ViajesService } from './viajes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ViajesService', () => {
  let service: ViajesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      viaje: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ViajesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ViajesService>(ViajesService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('findOne (ownership / IDOR)', () => {
    it('lanza NotFound si el viaje no existe', async () => {
      prisma.viaje.findUnique.mockResolvedValue(null);
      await expect(service.findOne(1, 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lanza Forbidden si el viaje es de otro usuario (IDOR)', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 2, id_viaje: 5 });
      await expect(service.findOne(1, 5)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('devuelve el viaje si es del usuario', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1, id_viaje: 5 });
      await expect(service.findOne(1, 5)).resolves.toMatchObject({
        id_viaje: 5,
      });
    });
  });

  describe('create', () => {
    it('mapea fechas y setea estado inicial planificado', async () => {
      prisma.viaje.create.mockResolvedValue({ id_viaje: 1 });
      await service.create(1, {
        origen: 'Buenos Aires',
        destino_principal: 'Mendoza',
        fecha_inicio: '2026-09-10',
        fecha_fin: '2026-09-12',
      });
      const arg = prisma.viaje.create.mock.calls[0][0] as any;
      expect(arg.data.id_usuario).toBe(1);
      expect(arg.data.estado).toBe('planificado');
      expect(arg.data.fechaInicio).toBeInstanceOf(Date);
      expect(arg.data.fechaFin).toBeInstanceOf(Date);
    });
  });

  describe('remove', () => {
    it('valida ownership y ejecuta el cascade dentro de una transacción', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1, id_viaje: 5 });
      const tx = {};
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
      const cascadeSpy = jest
        .spyOn(ViajesService, 'cascadeDeleteEnTx')
        .mockResolvedValue(undefined);

      const res = await service.remove(1, 5);
      expect(res.message).toMatch(/eliminado/i);
      expect(cascadeSpy).toHaveBeenCalledWith(tx, 5);
    });

    it('no borra nada si el viaje es de otro usuario', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 2, id_viaje: 5 });
      await expect(service.remove(1, 5)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
