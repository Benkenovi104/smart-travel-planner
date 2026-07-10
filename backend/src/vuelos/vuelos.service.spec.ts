import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { VuelosService } from './vuelos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkyScrapperService } from './sky-scrapper.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';

describe('VuelosService', () => {
  let service: VuelosService;
  let prisma: any;
  let sky: any;
  let presupuestos: any;

  const viaje = {
    id_viaje: 5,
    id_usuario: 1,
    origen: 'Buenos Aires',
    destino_principal: 'Mendoza',
    fechaInicio: new Date('2026-09-10'),
    fechaFin: new Date('2026-09-13'),
    cantidadPersonas: 2,
  };

  beforeEach(async () => {
    prisma = {
      viaje: { findUnique: jest.fn() },
      opcionVuelo: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          opcionVuelo: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
          },
        }),
      ),
    };
    sky = {
      resolverAeropuerto: jest.fn(),
      buscarVuelos: jest.fn(),
    };
    presupuestos = { recalcularConTx: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VuelosService,
        { provide: PrismaService, useValue: prisma },
        { provide: SkyScrapperService, useValue: sky },
        { provide: PresupuestosService, useValue: presupuestos },
      ],
    }).compile();
    service = module.get<VuelosService>(VuelosService);
  });

  it('lanza Forbidden si el viaje es de otro usuario', async () => {
    prisma.viaje.findUnique.mockResolvedValue({ ...viaje, id_usuario: 999 });
    await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lanza BadRequest si no se puede resolver origen o destino', async () => {
    prisma.viaje.findUnique.mockResolvedValue(viaje);
    sky.resolverAeropuerto.mockResolvedValue(null);
    await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rankea por precio y combina ida+vuelta, guardando hasta 5 opciones', async () => {
    prisma.viaje.findUnique.mockResolvedValue(viaje);
    sky.resolverAeropuerto.mockImplementation(async (n: string) => ({
      skyId: n,
      entityId: 'E',
    }));
    // ida desordenada por precio
    sky.buscarVuelos
      .mockResolvedValueOnce([
        { origen: 'Buenos Aires', destino: 'Mendoza', fecha: '2026-09-10', aerolinea: 'B', precio: 120, duracionMinutos: 100 },
        { origen: 'Buenos Aires', destino: 'Mendoza', fecha: '2026-09-10', aerolinea: 'A', precio: 80, duracionMinutos: 110 },
      ])
      // vuelta
      .mockResolvedValueOnce([
        { origen: 'Mendoza', destino: 'Buenos Aires', fecha: '2026-09-13', aerolinea: 'A', precio: 90, duracionMinutos: 105 },
        { origen: 'Mendoza', destino: 'Buenos Aires', fecha: '2026-09-13', aerolinea: 'B', precio: 130, duracionMinutos: 100 },
      ]);
    prisma.opcionVuelo.findMany.mockResolvedValue([]);

    let creados: any[] = [];
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        opcionVuelo: {
          deleteMany: jest.fn(),
          createMany: jest.fn((arg: any) => {
            creados = arg.data;
          }),
        },
      }),
    );

    await service.buscarYGuardar(1, 5);

    // ida más barata (80) combinada con vuelta más barata (90) = 170, primera opción
    expect(creados[0].precio).toBe(170);
    expect(creados[1].precio).toBe(250); // 120 + 130
    expect(creados.length).toBe(2);
    expect(creados[0].moneda).toBe('USD');
  });

  describe('seleccionar', () => {
    it('deselecciona las demás opciones del viaje y recalcula el presupuesto', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionVuelo.findUnique.mockResolvedValue({
        id_vuelo: 7,
        id_viaje: 5,
      });
      prisma.opcionVuelo.findMany.mockResolvedValue([]);

      const tx = {
        opcionVuelo: { update: jest.fn(), updateMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

      await service.seleccionar(1, 5, 7, true);

      expect(tx.opcionVuelo.updateMany).toHaveBeenCalledWith({
        where: { id_viaje: 5, seleccionado: true },
        data: { seleccionado: false },
      });
      expect(tx.opcionVuelo.update).toHaveBeenCalledWith({
        where: { id_vuelo: 7 },
        data: { seleccionado: true },
      });
      expect(presupuestos.recalcularConTx).toHaveBeenCalledWith(tx, 5);
    });

    it('al deseleccionar no toca las demás opciones', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionVuelo.findUnique.mockResolvedValue({
        id_vuelo: 7,
        id_viaje: 5,
      });
      prisma.opcionVuelo.findMany.mockResolvedValue([]);

      const tx = {
        opcionVuelo: { update: jest.fn(), updateMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

      await service.seleccionar(1, 5, 7, false);

      expect(tx.opcionVuelo.updateMany).not.toHaveBeenCalled();
      expect(tx.opcionVuelo.update).toHaveBeenCalledWith({
        where: { id_vuelo: 7 },
        data: { seleccionado: false },
      });
    });

    it('lanza NotFound si la opción es de otro viaje', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionVuelo.findUnique.mockResolvedValue({
        id_vuelo: 7,
        id_viaje: 99,
      });
      await expect(service.seleccionar(1, 5, 7, true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
