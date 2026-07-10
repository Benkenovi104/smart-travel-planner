import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { ItinerariosService } from './itinerarios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeminiService } from './gemini.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';
import { LugaresService } from '../lugares/lugares.service.js';
import { GeocodingService } from '../lugares/geocoding.service.js';

describe('ItinerariosService', () => {
  let service: ItinerariosService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      viaje: { findUnique: jest.fn() },
      itinerario: { findUnique: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItinerariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: GeminiService, useValue: { generarItinerario: jest.fn() } },
        { provide: PresupuestosService, useValue: { recalcularConTx: jest.fn() } },
        { provide: LugaresService, useValue: { buscarYCachear: jest.fn() } },
        { provide: GeocodingService, useValue: { geocodificar: jest.fn() } },
      ],
    }).compile();
    service = module.get<ItinerariosService>(ItinerariosService);
  });

  describe('getItinerario (guards)', () => {
    it('lanza NotFound si el viaje no existe', async () => {
      prisma.viaje.findUnique.mockResolvedValue(null);
      await expect(service.getItinerario(1, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lanza Forbidden si el viaje es de otro usuario (IDOR)', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 2 });
      await expect(service.getItinerario(1, 5)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lanza NotFound si el viaje aún no tiene itinerario', async () => {
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1 });
      prisma.itinerario.findUnique.mockResolvedValue(null);
      await expect(service.getItinerario(1, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('agregarActividad (validación)', () => {
    it('lanza BadRequest si no se envía id_lugar ni nombre_lugar', async () => {
      // el viaje es del usuario y ya tiene itinerario -> pasa los guards
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1 });
      prisma.itinerario.findUnique.mockResolvedValue({ id_itinerario: 1 });
      await expect(
        service.agregarActividad(1, 5, 10, { tipo_actividad: 'visita' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('reajustarFechasEnTx', () => {
    // tx con los días indicados (numeroDia -> id_dia), que registra las llamadas.
    function mockTx(numerosDia: number[] | null) {
      const updates: { id: number; fecha: Date }[] = [];
      const creados: { numeroDia: number; fecha: Date }[] = [];
      const borrados: number[] = [];
      const tx = {
        itinerario: {
          findUnique: jest
            .fn<any>()
            .mockResolvedValue(numerosDia ? { id_itinerario: 1 } : null),
        },
        diaItinerario: {
          findMany: jest.fn<any>().mockResolvedValue(
            (numerosDia ?? []).map((n) => ({
              id_dia_itinerario: n * 10,
              numeroDia: n,
            })),
          ),
          update: jest.fn<any>(({ where, data }: any) => {
            updates.push({ id: where.id_dia_itinerario, fecha: data.fecha });
          }),
          create: jest.fn<any>(({ data }: any) => {
            creados.push({ numeroDia: data.numeroDia, fecha: data.fecha });
          }),
          deleteMany: jest.fn<any>(({ where }: any) => {
            borrados.push(...where.id_dia_itinerario.in);
          }),
        },
        actividadItinerario: { deleteMany: jest.fn<any>() },
      };
      return { tx, updates, creados, borrados };
    }

    const iso = (d: Date) => d.toISOString().slice(0, 10);

    it('acorta: borra los días sobrantes con sus actividades', async () => {
      const { tx, borrados, updates } = mockTx([1, 2, 3, 4]);
      // 10/09 -> 11/09 = 2 días
      await service.reajustarFechasEnTx(
        tx as any,
        5,
        new Date('2026-09-10'),
        new Date('2026-09-11'),
      );
      // días 3 y 4 (ids 30, 40) se borran
      expect(borrados.sort((a, b) => a - b)).toEqual([30, 40]);
      expect(tx.actividadItinerario.deleteMany).toHaveBeenCalledWith({
        where: { id_dia_itinerario: { in: [30, 40] } },
      });
      // días 1 y 2 sobreviven y se recalcula su fecha
      expect(updates.map((u) => iso(u.fecha))).toEqual([
        '2026-09-10',
        '2026-09-11',
      ]);
      expect(tx.diaItinerario.create).not.toHaveBeenCalled();
    });

    it('alarga: crea días vacíos al final', async () => {
      const { tx, creados, borrados } = mockTx([1, 2, 3]);
      // 10/09 -> 14/09 = 5 días
      await service.reajustarFechasEnTx(
        tx as any,
        5,
        new Date('2026-09-10'),
        new Date('2026-09-14'),
      );
      expect(borrados).toEqual([]);
      expect(creados.map((c) => [c.numeroDia, iso(c.fecha)])).toEqual([
        [4, '2026-09-13'],
        [5, '2026-09-14'],
      ]);
    });

    it('mismo largo: sólo recalcula las fechas de los días', async () => {
      const { tx, updates, creados, borrados } = mockTx([1, 2, 3]);
      // corrido una semana, sigue siendo 3 días
      await service.reajustarFechasEnTx(
        tx as any,
        5,
        new Date('2026-09-17'),
        new Date('2026-09-19'),
      );
      expect(borrados).toEqual([]);
      expect(creados).toEqual([]);
      expect(updates.map((u) => iso(u.fecha))).toEqual([
        '2026-09-17',
        '2026-09-18',
        '2026-09-19',
      ]);
    });

    it('no hace nada si el viaje no tiene itinerario', async () => {
      const { tx, updates, creados, borrados } = mockTx(null);
      await service.reajustarFechasEnTx(
        tx as any,
        5,
        new Date('2026-09-10'),
        new Date('2026-09-12'),
      );
      expect(tx.diaItinerario.findMany).not.toHaveBeenCalled();
      expect([...updates, ...creados, ...borrados]).toEqual([]);
    });
  });
});
