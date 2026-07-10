import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { AlojamientoService } from './alojamiento.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingService } from './booking.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';

describe('AlojamientoService', () => {
  let service: AlojamientoService;
  let prisma: any;
  let booking: any;
  let presupuestos: any;

  const viaje = {
    id_viaje: 5,
    id_usuario: 1,
    destino_principal: 'Mendoza',
    fechaInicio: new Date('2026-09-10'),
    fechaFin: new Date('2026-09-13'), // 3 noches
    cantidadPersonas: 2,
  };

  beforeEach(async () => {
    prisma = {
      viaje: { findUnique: jest.fn() },
      opcionAlojamiento: { findMany: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    booking = { resolverDestino: jest.fn(), buscarHoteles: jest.fn() };
    presupuestos = { recalcularConTx: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlojamientoService,
        { provide: PrismaService, useValue: prisma },
        { provide: BookingService, useValue: booking },
        { provide: PresupuestosService, useValue: presupuestos },
      ],
    }).compile();
    service = module.get<AlojamientoService>(AlojamientoService);
  });

  it('lanza Forbidden si el viaje es de otro usuario', async () => {
    prisma.viaje.findUnique.mockResolvedValue({ ...viaje, id_usuario: 999 });
    await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lanza BadRequest si no se puede resolver el destino', async () => {
    prisma.viaje.findUnique.mockResolvedValue(viaje);
    booking.resolverDestino.mockResolvedValue(null);
    await expect(service.buscarYGuardar(1, 5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('calcula precio por noche (total / noches) y rankea ascendente', async () => {
    prisma.viaje.findUnique.mockResolvedValue(viaje);
    booking.resolverDestino.mockResolvedValue({ destId: 'X', searchType: 'city' });
    booking.buscarHoteles.mockResolvedValue([
      { nombre: 'Caro', precioTotal: 600, rating: 9, latitud: null, longitud: null }, // 200/noche
      { nombre: 'Barato', precioTotal: 150, rating: 8, latitud: null, longitud: null }, // 50/noche
      { nombre: 'Medio', precioTotal: 300, rating: 7, latitud: null, longitud: null }, // 100/noche
    ]);
    prisma.opcionAlojamiento.findMany.mockResolvedValue([]);

    let creados: any[] = [];
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        opcionAlojamiento: {
          deleteMany: jest.fn(),
          createMany: jest.fn((arg: any) => {
            creados = arg.data;
          }),
        },
      }),
    );

    await service.buscarYGuardar(1, 5);

    expect(creados.map((c) => c.precio_por_noche)).toEqual([50, 100, 200]);
    expect(creados[0].nombre).toBe('Barato');
  });

  describe('seleccionar', () => {
    it('deselecciona las demás opciones del viaje y recalcula el presupuesto', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionAlojamiento.findUnique.mockResolvedValue({
        id_alojamiento: 7,
        id_viaje: 5,
      });
      prisma.opcionAlojamiento.findMany.mockResolvedValue([]);

      const tx = {
        opcionAlojamiento: { update: jest.fn(), updateMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

      await service.seleccionar(1, 5, 7, true);

      expect(tx.opcionAlojamiento.updateMany).toHaveBeenCalledWith({
        where: { id_viaje: 5, seleccionado: true },
        data: { seleccionado: false },
      });
      expect(tx.opcionAlojamiento.update).toHaveBeenCalledWith({
        where: { id_alojamiento: 7 },
        data: { seleccionado: true },
      });
      expect(presupuestos.recalcularConTx).toHaveBeenCalledWith(tx, 5);
    });

    it('lanza NotFound si la opción es de otro viaje', async () => {
      prisma.viaje.findUnique.mockResolvedValue(viaje);
      prisma.opcionAlojamiento.findUnique.mockResolvedValue({
        id_alojamiento: 7,
        id_viaje: 99,
      });
      await expect(service.seleccionar(1, 5, 7, true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
