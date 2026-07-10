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

  describe('optimizarDia', () => {
    // 4 paradas en línea (lng fijo, lat 0/3/1/2) en orden zigzag A,B,C,D.
    // El recorrido más corto desde A es A -> C -> D -> B (lat 0,1,2,3).
    const hora = (h: number) => new Date(`1970-01-01T${String(h).padStart(2, '0')}:00:00Z`);
    function actividadesZigzag() {
      return [
        { id_actividad: 1, orden: 1, hora_inicio_estimada: hora(9), hora_fin_estimada: hora(10), lugares: { latitud: 0, longitud: 0, nombre: 'A' } },
        { id_actividad: 2, orden: 2, hora_inicio_estimada: hora(10), hora_fin_estimada: hora(11), lugares: { latitud: 3, longitud: 0, nombre: 'B' } },
        { id_actividad: 3, orden: 3, hora_inicio_estimada: hora(11), hora_fin_estimada: hora(12), lugares: { latitud: 1, longitud: 0, nombre: 'C' } },
        { id_actividad: 4, orden: 4, hora_inicio_estimada: hora(12), hora_fin_estimada: hora(13), lugares: { latitud: 2, longitud: 0, nombre: 'D' } },
      ];
    }

    function mockTx(actividades: any[]) {
      const updates: any[] = [];
      const tx = {
        diaItinerario: {
          findUnique: jest.fn<any>().mockResolvedValue({
            id_dia_itinerario: 20,
            id_itinerario: 1,
            numeroDia: 2,
          }),
        },
        actividadItinerario: {
          findMany: jest.fn<any>().mockResolvedValue(actividades),
          update: jest.fn<any>(({ where, data }: any) => {
            updates.push({ id: where.id_actividad, ...data });
          }),
        },
        cambioItinerario: { create: jest.fn<any>() },
      };
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1 });
      prisma.itinerario.findUnique.mockResolvedValue({ id_itinerario: 1 });
      prisma.$transaction = jest.fn<any>(async (cb: any) => cb(tx));
      return { tx, updates };
    }

    it('reordena por cercanía y corre los horarios a la nueva secuencia', async () => {
      const { updates } = mockTx(actividadesZigzag());
      await service.optimizarDia(1, 5, 20);

      // Orden esperado: A(1), C(3), D(4), B(2).
      expect(updates.map((u) => u.id)).toEqual([1, 3, 4, 2]);
      expect(updates.map((u) => u.orden)).toEqual([1, 2, 3, 4]);
      // Las franjas horarias quedan en la misma secuencia (9,10,11,12), sólo
      // cambia qué actividad ocupa cada una.
      expect(updates.map((u) => u.hora_inicio_estimada.getUTCHours())).toEqual([
        9, 10, 11, 12,
      ]);
    });

    it('no escribe nada si el orden ya era óptimo', async () => {
      // A, C, D, B ya es el recorrido óptimo.
      const acts = actividadesZigzag();
      const yaOptimo = [acts[0], acts[2], acts[3], acts[1]].map((a, i) => ({
        ...a,
        orden: i + 1,
      }));
      const { updates } = mockTx(yaOptimo);
      const res = await service.optimizarDia(1, 5, 20);
      expect(res.optimizada).toBe(false);
      expect(updates).toEqual([]);
    });

    it('lanza BadRequest si hay menos de 3 actividades con ubicación', async () => {
      const pocas = [
        { id_actividad: 1, orden: 1, hora_inicio_estimada: null, hora_fin_estimada: null, lugares: { latitud: 0, longitud: 0, nombre: 'A' } },
        { id_actividad: 2, orden: 2, hora_inicio_estimada: null, hora_fin_estimada: null, lugares: { latitud: null, longitud: null, nombre: 'sin coords' } },
      ];
      mockTx(pocas);
      await expect(service.optimizarDia(1, 5, 20)).rejects.toBeInstanceOf(
        BadRequestException,
      );
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
              // Fecha actual del día: inicio 10/09 + (n-1) días. Sirve para que
              // reajustar detecte cuándo la fecha NO cambió y se saltee el update.
              fecha: new Date(Date.UTC(2026, 8, 9 + n)),
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
      // días 1 y 2 sobreviven con la misma fecha (sólo se movió fecha_fin), así
      // que no se toca ninguno.
      expect(updates).toEqual([]);
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
