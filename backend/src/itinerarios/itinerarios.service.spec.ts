import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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

  describe('agregarActividad (horarios)', () => {
    const t = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

    // Día con dos actividades: 09:00–10:00 (orden 1) y 15:00–16:00 (orden 2).
    function mockTx(existentes: any[]) {
      const updateMany = jest.fn<any>();
      const create = jest.fn<any>().mockResolvedValue({ lugares: { nombre: 'X' } });
      const tx = {
        diaItinerario: {
          findUnique: jest.fn<any>().mockResolvedValue({
            id_dia_itinerario: 10,
            id_itinerario: 1,
            numeroDia: 1,
          }),
        },
        actividadItinerario: {
          findMany: jest.fn<any>().mockResolvedValue(existentes),
          updateMany,
          create,
        },
        lugar: { findUnique: jest.fn<any>().mockResolvedValue({ id_lugar: 5 }) },
        cambioItinerario: { create: jest.fn<any>() },
      };
      prisma.viaje.findUnique.mockResolvedValue({ id_usuario: 1 });
      prisma.itinerario.findUnique.mockResolvedValue({ id_itinerario: 1 });
      prisma.$transaction = jest.fn<any>(async (cb: any) => cb(tx));
      return { tx, updateMany, create };
    }

    const dia = () => [
      { id_actividad: 1, orden: 1, hora_inicio_estimada: t('09:00'), hora_fin_estimada: t('10:00') },
      { id_actividad: 2, orden: 2, hora_inicio_estimada: t('15:00'), hora_fin_estimada: t('16:00') },
    ];

    it('inserta en la posición cronológica según la hora', async () => {
      const { updateMany, create } = mockTx(dia());
      // 12:00 va entre las 10:00 y las 15:00 -> antes de la actividad orden 2.
      await service.agregarActividad(1, 5, 10, {
        id_lugar: 5,
        hora_inicio: '12:00',
        hora_fin: '13:00',
      });
      expect(updateMany).toHaveBeenCalledWith({
        where: { id_dia_itinerario: 10, orden: { gte: 2 } },
        data: { orden: { increment: 1 } },
      });
      expect(create.mock.calls[0][0].data.orden).toBe(2);
    });

    it('sin hora va al final', async () => {
      const { create } = mockTx(dia());
      await service.agregarActividad(1, 5, 10, { id_lugar: 5 });
      expect(create.mock.calls[0][0].data.orden).toBe(3);
    });

    it('rechaza (409) si el horario se pisa con otra actividad', async () => {
      mockTx(dia());
      // 09:30 cae dentro de la actividad 09:00–10:00.
      await expect(
        service.agregarActividad(1, 5, 10, {
          id_lugar: 5,
          hora_inicio: '09:30',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('permite una actividad pegada (11:00 justo después de 10:00)', async () => {
      const { create } = mockTx(dia());
      await service.agregarActividad(1, 5, 10, {
        id_lugar: 5,
        hora_inicio: '10:00',
        hora_fin: '11:00',
      });
      expect(create).toHaveBeenCalled();
    });

    it('rechaza si la hora de fin no es posterior a la de inicio', async () => {
      mockTx(dia());
      await expect(
        service.agregarActividad(1, 5, 10, {
          id_lugar: 5,
          hora_inicio: '12:00',
          hora_fin: '11:00',
        }),
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

    it('deja los horarios en orden cronológico aunque entren desordenados', async () => {
      // Mismas 4 paradas, pero con las horas puestas fuera de orden por posición
      // (como si se hubieran arrastrado a mano antes de optimizar).
      const acts = actividadesZigzag().map((a, i) => ({
        ...a,
        hora_inicio_estimada: [hora(12), hora(9), hora(14), hora(10)][i],
        hora_fin_estimada: null,
      }));
      const { updates } = mockTx(acts);
      await service.optimizarDia(1, 5, 20);

      // Orden espacial A,C,D,B; las horas se reparten cronológicas: 9,10,12,14.
      expect(updates.map((u) => u.id)).toEqual([1, 3, 4, 2]);
      expect(updates.map((u) => u.hora_inicio_estimada.getUTCHours())).toEqual([
        9, 10, 12, 14,
      ]);
    });

    it('no escribe nada si el orden ya era óptimo y las horas ya eran cronológicas', async () => {
      // A, C, D, B ya es el recorrido óptimo, con horas 9,10,11,12 en ese orden.
      const acts = actividadesZigzag();
      const yaOptimo = [acts[0], acts[2], acts[3], acts[1]].map((a, i) => ({
        ...a,
        orden: i + 1,
        hora_inicio_estimada: hora(9 + i),
        hora_fin_estimada: hora(10 + i),
      }));
      const { updates } = mockTx(yaOptimo);
      const res = await service.optimizarDia(1, 5, 20);
      expect(res.optimizada).toBe(false);
      expect(updates).toEqual([]);
    });

    it('agrupa por zona y mete el traslado en el cruce (multi-ciudad)', async () => {
      // Caso real: Córdoba (3 destinos) + Villa Carlos Paz (2 destinos) + 2
      // traslados geocodificados al centro de Córdoba. Orden original con las
      // dos ciudades interleavadas por los traslados al principio.
      const cba = (lng: number) => ({ latitud: -31.42, longitud: lng });
      const cp = (lng: number) => ({ latitud: -31.43, longitud: lng });
      const acts = [
        { id_actividad: 6, orden: 1, tipo_actividad: 'transporte', hora_inicio_estimada: hora(8), hora_fin_estimada: hora(9), lugares: cba(-64.1833) },
        { id_actividad: 7, orden: 2, tipo_actividad: 'transporte', hora_inicio_estimada: hora(9), hora_fin_estimada: hora(10), lugares: cba(-64.1833) },
        { id_actividad: 1, orden: 3, tipo_actividad: 'visita', hora_inicio_estimada: hora(13), hora_fin_estimada: hora(14), lugares: cba(-64.1835) },
        { id_actividad: 2, orden: 4, tipo_actividad: 'visita', hora_inicio_estimada: hora(14), hora_fin_estimada: hora(15), lugares: cba(-64.1807) },
        { id_actividad: 3, orden: 5, tipo_actividad: 'comida', hora_inicio_estimada: hora(15), hora_fin_estimada: hora(16), lugares: cba(-64.1927) },
        { id_actividad: 4, orden: 6, tipo_actividad: 'entretenimiento', hora_inicio_estimada: hora(17), hora_fin_estimada: hora(18), lugares: cp(-64.4904) },
        { id_actividad: 5, orden: 7, tipo_actividad: 'comida', hora_inicio_estimada: hora(20), hora_fin_estimada: hora(21), lugares: cp(-64.4988) },
      ];
      const { updates } = mockTx(acts);
      await service.optimizarDia(1, 5, 20);

      const ids = updates.map((u) => u.id);
      // Los 3 de Córdoba contiguos, luego un traslado, luego los 2 de Carlos Paz,
      // luego el otro traslado.
      expect(ids.slice(0, 3).sort()).toEqual([1, 2, 3]);
      expect([6, 7]).toContain(ids[3]);
      expect(ids.slice(4, 6).sort()).toEqual([4, 5]);
      expect([6, 7]).toContain(ids[6]);
      expect(ids[3]).not.toBe(ids[6]);
      // Horarios cronológicos.
      const hs = updates.map((u) => u.hora_inicio_estimada.getUTCHours());
      expect(hs.every((h, i) => i === 0 || hs[i - 1] <= h)).toBe(true);
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
