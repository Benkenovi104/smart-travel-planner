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
import { PlanesService } from '../planes/planes.service.js';
import { LimitePlanException } from '../planes/limite-plan.exception.js';

describe('VuelosService', () => {
  let service: VuelosService;
  let prisma: any;
  let sky: any;
  let presupuestos: any;
  let planes: any;

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
    planes = { verificar: jest.fn(), registrar: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VuelosService,
        { provide: PrismaService, useValue: prisma },
        { provide: SkyScrapperService, useValue: sky },
        { provide: PresupuestosService, useValue: presupuestos },
        { provide: PlanesService, useValue: planes },
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

  it('guarda el detalle de cada tramo por separado, no sólo el total', async () => {
    prisma.viaje.findUnique.mockResolvedValue(viaje);
    sky.resolverAeropuerto.mockImplementation(async (n: string) => ({
      skyId: n,
      entityId: 'E',
    }));
    sky.buscarVuelos
      .mockResolvedValueOnce([
        { origen: 'Buenos Aires', destino: 'Mendoza', fecha: '2026-09-10T21:55:00', llegada: '2026-09-11T01:20:00', aerolinea: 'Ethiopian', precio: 80, duracionMinutos: 205, escalas: 1 },
      ])
      .mockResolvedValueOnce([
        { origen: 'Mendoza', destino: 'Buenos Aires', fecha: '2026-09-13T09:00:00', llegada: '2026-09-13T10:45:00', aerolinea: 'LATAM', precio: 90, duracionMinutos: 105, escalas: 0 },
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
    const o = creados[0];

    // Cada dirección conserva su aerolínea y su precio: la ida y la vuelta son
    // dos pasajes distintos y pueden ser de compañías diferentes.
    expect(o.aerolinea).toBe('Ethiopian');
    expect(o.aerolinea_vuelta).toBe('LATAM');
    expect(o.precio_ida).toBe(80);
    expect(o.precio_vuelta).toBe(90);
    expect(o.precio).toBe(170);
    expect(o.escalas_ida).toBe(1);
    expect(o.escalas_vuelta).toBe(0);
    expect(o.duracion_ida).toBe(205);
    expect(o.duracion_total).toBe(310);
  });

  it('no corre las horas del vuelo por la zona horaria del servidor', async () => {
    prisma.viaje.findUnique.mockResolvedValue(viaje);
    sky.resolverAeropuerto.mockImplementation(async (n: string) => ({
      skyId: n,
      entityId: 'E',
    }));
    // Sky Scrapper manda la hora local del aeropuerto, sin zona.
    sky.buscarVuelos
      .mockResolvedValueOnce([
        { origen: 'Buenos Aires', destino: 'Mendoza', fecha: '2026-09-10T21:55:00', llegada: '2026-09-10T23:40:00', aerolinea: 'A', precio: 80, duracionMinutos: 105, escalas: 0 },
      ])
      .mockResolvedValueOnce([]);
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

    // Sale 21:55 del día 10: se guarda tal cual, no corrido al día siguiente
    // por interpretar el string en la zona del server.
    expect(creados[0].fechaSalida.toISOString()).toBe('2026-09-10T21:55:00.000Z');
    expect(creados[0].llegada_ida.toISOString()).toBe('2026-09-10T23:40:00.000Z');
  });

  describe('plan', () => {
    const preparar = () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      sky.resolverAeropuerto.mockImplementation(async (n: string) => ({
        skyId: n,
        entityId: 'E',
      }));
      prisma.opcionVuelo.findMany.mockResolvedValue([]);
    };

    it('si el plan no permite buscar vuelos, no le pega a Sky Scrapper', async () => {
      preparar();
      planes.verificar.mockRejectedValue(
        new LimitePlanException({
          message: 'Buscar vuelos no está incluido en el plan Gratis.',
          accion: 'BUSCAR_VUELOS',
          planActual: 'GRATIS',
          planSugerido: 'BASE',
          limite: 0,
          usado: 0,
          renuevaEl: null,
        }),
      );

      await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
        LimitePlanException,
      );
      expect(planes.verificar).toHaveBeenCalledWith(1, 'BUSCAR_VUELOS', 5);
      expect(sky.resolverAeropuerto).not.toHaveBeenCalled();
      expect(sky.buscarVuelos).not.toHaveBeenCalled();
    });

    it('registra el consumo dentro de la transacción cuando encuentra vuelos', async () => {
      preparar();
      sky.buscarVuelos.mockResolvedValue([
        { origen: 'Buenos Aires', destino: 'Mendoza', fecha: '2026-09-10T08:00:00', llegada: null, aerolinea: 'A', precio: 80, duracionMinutos: 100, escalas: 0 },
      ]);

      await service.buscarYGuardar(1, 5);

      expect(planes.registrar).toHaveBeenCalledWith(
        1,
        'BUSCAR_VUELOS',
        5,
        expect.anything(),
      );
    });

    it('una búsqueda sin resultados no gasta el intento', async () => {
      preparar();
      sky.buscarVuelos.mockResolvedValue([]);

      await service.buscarYGuardar(1, 5);

      expect(planes.registrar).not.toHaveBeenCalled();
    });

    it('si la API falla, no registra consumo', async () => {
      preparar();
      sky.buscarVuelos.mockRejectedValue(new Error('cuota agotada'));

      await expect(service.buscarYGuardar(1, 5)).rejects.toThrow('cuota agotada');
      expect(planes.registrar).not.toHaveBeenCalled();
    });
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
