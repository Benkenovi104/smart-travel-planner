import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { ViajesService } from './viajes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';
import { ItinerariosService } from '../itinerarios/itinerarios.service.js';
import { PlanesService } from '../planes/planes.service.js';
import { LimitePlanException } from '../planes/limite-plan.exception.js';

describe('ViajesService', () => {
  let service: ViajesService;
  let prisma: any;
  let presupuestos: any;
  let itinerarios: any;
  let planes: any;

  const nuevoViaje = {
    origen: 'Buenos Aires',
    destino_principal: 'Mendoza',
    fecha_inicio: '2026-09-10',
    fecha_fin: '2026-09-12',
  };

  beforeEach(async () => {
    prisma = {
      viaje: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    presupuestos = { recalcularConTx: jest.fn() };
    itinerarios = { reajustarFechasEnTx: jest.fn() };
    planes = { verificar: jest.fn(), registrar: jest.fn() };
    // Sin borradores abiertos por defecto.
    prisma.viaje.findFirst.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViajesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PresupuestosService, useValue: presupuestos },
        { provide: ItinerariosService, useValue: itinerarios },
        { provide: PlanesService, useValue: planes },
      ],
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
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (cb: any) =>
        cb({ viaje: prisma.viaje }),
      );
    });

    it('mapea fechas y setea estado inicial borrador', async () => {
      prisma.viaje.create.mockResolvedValue({ id_viaje: 1 });
      await service.create(1, {
        origen: 'Buenos Aires',
        destino_principal: 'Mendoza',
        fecha_inicio: '2026-09-10',
        fecha_fin: '2026-09-12',
      });
      const arg = prisma.viaje.create.mock.calls[0][0] as any;
      expect(arg.data.id_usuario).toBe(1);
      expect(arg.data.estado).toBe('borrador');
      expect(arg.data.fechaInicio).toBeInstanceOf(Date);
      expect(arg.data.fechaFin).toBeInstanceOf(Date);
    });

    it('verifica el plan antes de crear y registra el consumo en la misma transacción', async () => {
      prisma.viaje.create.mockResolvedValue({ id_viaje: 9 });

      await service.create(1, nuevoViaje);

      expect(planes.verificar).toHaveBeenCalledWith(1, 'CREAR_VIAJE');
      expect(planes.registrar).toHaveBeenCalledWith(
        1,
        'CREAR_VIAJE',
        9,
        expect.objectContaining({ viaje: prisma.viaje }),
      );
    });

    it('si el plan no permite otro viaje, no crea nada', async () => {
      planes.verificar.mockRejectedValue(
        new LimitePlanException({
          message: 'Tu plan Gratis incluye 1 viaje por período.',
          accion: 'CREAR_VIAJE',
          planActual: 'GRATIS',
          planSugerido: 'MEDIO',
          limite: 1,
          usado: 1,
          renuevaEl: null,
        }),
      );

      await expect(service.create(1, nuevoViaje)).rejects.toBeInstanceOf(
        LimitePlanException,
      );
      expect(prisma.viaje.create).not.toHaveBeenCalled();
    });

    it('con un borrador abierto responde 409 con su id, sin gastar cupo', async () => {
      prisma.viaje.findFirst.mockResolvedValue({ id_viaje: 3 });

      const error: any = await service.create(1, nuevoViaje).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({
        codigo: 'BORRADOR_EXISTENTE',
        idViaje: 3,
      });
      expect(planes.verificar).not.toHaveBeenCalled();
      expect(prisma.viaje.create).not.toHaveBeenCalled();
    });

    it('rechaza un rango de fechas invertido', async () => {
      await expect(
        service.create(1, {
          origen: 'Buenos Aires',
          destino_principal: 'Mendoza',
          fecha_inicio: '2026-09-12',
          fecha_fin: '2026-09-10',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.viaje.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const viajeActual = {
      id_usuario: 1,
      id_viaje: 5,
      fechaInicio: new Date('2026-09-10'),
      fechaFin: new Date('2026-09-15'),
    };

    function mockTx() {
      const tx = { viaje: { update: jest.fn<any>().mockResolvedValue({ id_viaje: 5 }) } };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
      return tx;
    }

    beforeEach(() => prisma.viaje.findUnique.mockResolvedValue(viajeActual));

    it('reajusta el itinerario y recalcula el presupuesto cuando cambian las fechas', async () => {
      const tx = mockTx();
      await service.update(1, 5, { fecha_fin: '2026-09-20' });
      expect(tx.viaje.update).toHaveBeenCalled();
      expect(itinerarios.reajustarFechasEnTx).toHaveBeenCalledWith(
        tx,
        5,
        viajeActual.fechaInicio,
        new Date('2026-09-20'),
      );
      expect(presupuestos.recalcularConTx).toHaveBeenCalledWith(tx, 5);
    });

    it('reajusta el itinerario antes de recalcular el presupuesto', async () => {
      // Acortar puede borrar días con actividades: el presupuesto tiene que
      // recalcularse sobre lo que quedó, no antes.
      const orden: string[] = [];
      itinerarios.reajustarFechasEnTx.mockImplementation(async () => {
        orden.push('reajustar');
      });
      presupuestos.recalcularConTx.mockImplementation(async () => {
        orden.push('recalcular');
      });
      mockTx();
      await service.update(1, 5, { fecha_fin: '2026-09-20' });
      expect(orden).toEqual(['reajustar', 'recalcular']);
    });

    it('no toca itinerario ni presupuesto si las fechas no cambian', async () => {
      mockTx();
      await service.update(1, 5, { estado: 'completado' });
      expect(itinerarios.reajustarFechasEnTx).not.toHaveBeenCalled();
      expect(presupuestos.recalcularConTx).not.toHaveBeenCalled();
    });

    it('valida el rango contra las fechas ya guardadas, no sólo contra el DTO', async () => {
      // Sólo llega `fecha_fin`, y queda antes de la `fecha_inicio` persistida.
      await expect(
        service.update(1, 5, { fecha_fin: '2026-09-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('no deja editar el viaje de otro usuario (IDOR)', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ ...viajeActual, id_usuario: 2 });
      await expect(
        service.update(1, 5, { estado: 'completado' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
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
