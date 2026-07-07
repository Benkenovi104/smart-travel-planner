import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { PresupuestosService } from './presupuestos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PresupuestosService', () => {
  let service: PresupuestosService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      viaje: { findUnique: jest.fn() },
      presupuesto: { findUnique: jest.fn() },
      gastoEstimado: { findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresupuestosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<PresupuestosService>(PresupuestosService);
  });

  describe('recalcularConTx (desglose por categoría)', () => {
    const act = (tipo: string | null, costo: number) => ({
      tipo_actividad: tipo,
      costoEstimado: costo,
      lugares: { nombre: `Lugar ${tipo ?? 'sin-tipo'}` },
    });

    it('suma cada categoría y mete el resto en "actividades"', async () => {
      const itinerario = {
        id_itinerario: 1,
        dias_itinerario: [
          {
            actividades_itinerario: [
              act('alojamiento', 100),
              act('comida', 50),
              act('comida', 30),
              act('transporte', 20),
              act('visita', 40), // catch-all -> actividades
              act(null, 10), // sin tipo -> actividades
            ],
          },
        ],
      };
      const tx = {
        itinerario: { findUnique: jest.fn(async () => itinerario) },
        presupuesto: { upsert: jest.fn() },
        gastoEstimado: { deleteMany: jest.fn(), createMany: jest.fn() },
      };

      await service.recalcularConTx(tx as any, 5);

      const upsertArg = tx.presupuesto.upsert.mock.calls[0][0] as any;
      expect(upsertArg.create).toMatchObject({
        monto_alojamiento: 100,
        monto_comidas: 80,
        monto_transporte_local: 20,
        monto_actividades: 50, // 40 + 10
        monto_vuelos: 0,
        monto_total: 250,
      });
      // una línea de gasto por cada actividad con costo > 0
      const createManyArg = tx.gastoEstimado.createMany.mock.calls[0][0] as any;
      expect(createManyArg.data).toHaveLength(6);
    });

    it('no hace nada si el viaje todavía no tiene itinerario', async () => {
      const tx = {
        itinerario: { findUnique: jest.fn(async () => null) },
        presupuesto: { upsert: jest.fn() },
        gastoEstimado: { deleteMany: jest.fn(), createMany: jest.fn() },
      };
      await service.recalcularConTx(tx as any, 5);
      expect(tx.presupuesto.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getPresupuesto', () => {
    it('lanza Forbidden si el viaje es de otro usuario', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 2 });
      await expect(service.getPresupuesto(1, 5)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lanza NotFound si el viaje no tiene presupuesto aún', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1 });
      prisma.presupuesto.findUnique.mockResolvedValue(null);
      await expect(service.getPresupuesto(1, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('devuelve el presupuesto con sus gastos', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1 });
      prisma.presupuesto.findUnique.mockResolvedValue({ monto_total: 250 });
      prisma.gastoEstimado.findMany.mockResolvedValue([{ id_gasto: 1 }]);
      const res = await service.getPresupuesto(1, 5);
      expect(res.monto_total).toBe(250);
      expect(res.gastos_estimados).toHaveLength(1);
    });
  });
});
