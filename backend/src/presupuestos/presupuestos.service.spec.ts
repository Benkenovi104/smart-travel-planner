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

    // 3 noches entre inicio y fin.
    const viaje = {
      id_viaje: 5,
      fechaInicio: new Date('2026-09-10'),
      fechaFin: new Date('2026-09-13'),
    };

    /** Arma un `tx` mockeado con lo que `recalcularConTx` consulta. */
    const makeTx = (opts: {
      itinerario?: unknown;
      vuelo?: unknown;
      alojamiento?: unknown;
      presupuestoExistente?: unknown;
    }) => ({
      viaje: { findUnique: jest.fn(async () => viaje) },
      itinerario: { findUnique: jest.fn(async () => opts.itinerario ?? null) },
      opcionVuelo: { findFirst: jest.fn(async () => opts.vuelo ?? null) },
      opcionAlojamiento: {
        findFirst: jest.fn(async () => opts.alojamiento ?? null),
      },
      presupuesto: {
        upsert: jest.fn(),
        findUnique: jest.fn(async () => opts.presupuestoExistente ?? null),
      },
      gastoEstimado: { deleteMany: jest.fn(), createMany: jest.fn() },
    });

    const itinerarioCompleto = {
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

    it('suma cada categoría y mete el resto en "actividades"', async () => {
      const tx = makeTx({ itinerario: itinerarioCompleto });

      await service.recalcularConTx(tx as any, 5);

      const upsertArg = tx.presupuesto.upsert.mock.calls[0][0] as any;
      expect(upsertArg.create).toMatchObject({
        // El itinerario nunca aporta alojamiento: sale solo del hotel elegido.
        monto_alojamiento: 0,
        monto_comidas: 80,
        monto_transporte_local: 20,
        monto_actividades: 50, // 40 + 10
        monto_vuelos: 0,
        monto_total: 150,
      });
      // una línea por actividad con costo > 0, salvo la de tipo alojamiento
      const createManyArg = tx.gastoEstimado.createMany.mock.calls[0][0] as any;
      expect(createManyArg.data).toHaveLength(5);
      expect(
        createManyArg.data.filter((g: any) => g.categoria === 'alojamiento'),
      ).toHaveLength(0);
    });

    it('suma el vuelo elegido y el alojamiento elegido por noche', async () => {
      const tx = makeTx({
        itinerario: itinerarioCompleto,
        vuelo: {
          precio: 300,
          aerolinea: 'Flybondi',
          origen: 'Buenos Aires',
          destino: 'Mendoza',
        },
        alojamiento: { nombre: 'Hotel Test', precio_por_noche: 70 },
      });

      await service.recalcularConTx(tx as any, 5);

      const upsertArg = tx.presupuesto.upsert.mock.calls[0][0] as any;
      expect(upsertArg.create).toMatchObject({
        monto_vuelos: 300,
        monto_alojamiento: 210, // 70 * 3 noches, solo del hotel elegido
        monto_total: 660, // 150 del itinerario + 300 vuelo + 210 hotel
      });

      // Vuelo y hotel aparecen como líneas de gasto propias, primero. La actividad
      // de alojamiento del itinerario queda fuera del detalle porque no suma.
      const gastos = (tx.gastoEstimado.createMany.mock.calls[0][0] as any).data;
      expect(gastos).toHaveLength(7);
      expect(gastos[0]).toMatchObject({ categoria: 'vuelo', montoEstimado: 300 });
      expect(gastos[1]).toMatchObject({
        categoria: 'alojamiento',
        montoEstimado: 210,
      });
      expect(gastos[1].descripcion).toContain('3 noches');
      expect(
        gastos.filter((g: any) => g.descripcion === 'Lugar alojamiento'),
      ).toHaveLength(0);
    });

    it('calcula el presupuesto de un vuelo elegido aunque no haya itinerario', async () => {
      const tx = makeTx({ vuelo: { precio: 300, aerolinea: 'Flybondi' } });

      await service.recalcularConTx(tx as any, 5);

      const upsertArg = tx.presupuesto.upsert.mock.calls[0][0] as any;
      expect(upsertArg.create).toMatchObject({
        monto_vuelos: 300,
        monto_actividades: 0,
        monto_total: 300,
      });
    });

    it('no hace nada si el viaje no tiene itinerario ni opciones elegidas', async () => {
      const tx = makeTx({});
      await service.recalcularConTx(tx as any, 5);
      expect(tx.presupuesto.upsert).not.toHaveBeenCalled();
    });

    it('baja a cero un presupuesto ya existente al deseleccionar la última opción', async () => {
      const tx = makeTx({ presupuestoExistente: { monto_total: 300 } });

      await service.recalcularConTx(tx as any, 5);

      const upsertArg = tx.presupuesto.upsert.mock.calls[0][0] as any;
      expect(upsertArg.update).toMatchObject({
        monto_vuelos: 0,
        monto_total: 0,
      });
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
