import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { PlanesService } from './planes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  LimitePlanException,
  TopeDiarioException,
} from './limite-plan.exception.js';

const utc = (anio: number, mes: number, dia: number, hora = 0) =>
  new Date(Date.UTC(anio, mes - 1, dia, hora));

// "Hoy" fijo en todos los tests: 14/09/2026 al mediodía UTC.
const AHORA = utc(2026, 9, 14, 12);

const suscripcion = (datos: Record<string, unknown>) => ({
  id_suscripcion: 1,
  id_usuario: 1,
  plan: 'BASE',
  estado: 'ACTIVA',
  mp_preapproval_id: null,
  dia_ancla: utc(2026, 9, 1),
  vigente_desde: utc(2026, 9, 1),
  vigente_hasta: null,
  cancelada_en: null,
  creada_en: utc(2026, 9, 1),
  ...datos,
});

/** Ejecuta y devuelve el error, para poder inspeccionar el cuerpo del 403. */
const capturar = async (promesa: Promise<unknown>): Promise<any> =>
  promesa.then(
    () => {
      throw new Error('Se esperaba que la verificación fallara');
    },
    (error: unknown) => error,
  );

describe('PlanesService', () => {
  let service: PlanesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      usuario: { findUnique: jest.fn() },
      suscripcion: { findMany: jest.fn() },
      consumo: { count: jest.fn(), create: jest.fn() },
    };
    // Registrado el 13/08: en Gratis, el período vigente va del 13/09 al 13/10.
    prisma.usuario.findUnique.mockResolvedValue({
      fecha_registro: utc(2026, 8, 13),
    });
    prisma.suscripcion.findMany.mockResolvedValue([]);
    prisma.consumo.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlanesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<PlanesService>(PlanesService);
  });

  describe('planVigente', () => {
    it('sin suscripciones está en Gratis, con el período anclado al registro', async () => {
      const vigente = await service.planVigente(1, AHORA);

      expect(vigente).toMatchObject({
        plan: 'GRATIS',
        estado: null,
        periodoDesde: utc(2026, 9, 13),
        periodoHasta: utc(2026, 10, 13),
      });
    });

    it('no pide las suscripciones pendientes de pago', async () => {
      await service.planVigente(1, AHORA);

      expect(prisma.suscripcion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_usuario: 1, estado: { not: 'PENDIENTE' } },
        }),
      );
    });

    it('un plan asignado a mano, sin vigente_hasta, no vence', async () => {
      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({ plan: 'PREMIUM' }),
      ]);

      const vigente = await service.planVigente(1, AHORA);

      expect(vigente).toMatchObject({
        plan: 'PREMIUM',
        estado: 'ACTIVA',
        vigenteHasta: null,
        periodoDesde: utc(2026, 9, 1),
      });
    });

    it('vencido el período pago, sigue activo en gracia durante 3 días', async () => {
      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({ vigente_hasta: utc(2026, 9, 13) }),
      ]);

      const vigente = await service.planVigente(1, AHORA);

      expect(vigente).toMatchObject({ plan: 'BASE', estado: 'EN_GRACIA' });
    });

    it('pasada la gracia vuelve a Gratis, con el período anclado al fin del plan pago', async () => {
      // Pago hasta el 10/09 + 3 días de gracia = acceso hasta el 13/09.
      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({ vigente_hasta: utc(2026, 9, 10) }),
      ]);

      const vigente = await service.planVigente(1, AHORA);

      expect(vigente).toMatchObject({
        plan: 'GRATIS',
        periodoDesde: utc(2026, 9, 13),
      });
    });

    it('una cancelada da acceso hasta el fin del período pagado, sin gracia', async () => {
      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({
          plan: 'PREMIUM',
          estado: 'CANCELADA',
          vigente_hasta: utc(2026, 10, 1),
        }),
      ]);
      expect((await service.planVigente(1, AHORA)).plan).toBe('PREMIUM');

      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({
          plan: 'PREMIUM',
          estado: 'CANCELADA',
          vigente_hasta: utc(2026, 9, 13),
        }),
      ]);
      expect((await service.planVigente(1, AHORA)).plan).toBe('GRATIS');
    });

    it('si dos suscripciones dan acceso (subida de plan), gana la mayor', async () => {
      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({ id_suscripcion: 2, plan: 'BASE' }),
        suscripcion({ id_suscripcion: 1, plan: 'PREMIUM' }),
      ]);

      const vigente = await service.planVigente(1, AHORA);

      expect(vigente).toMatchObject({ plan: 'PREMIUM', idSuscripcion: 1 });
    });

    it('un checkout abandonado y dado de baja no corre el período de Gratis', async () => {
      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({
          estado: 'CANCELADA',
          mp_preapproval_id: 'mp-abandonada',
          vigente_desde: null,
          cancelada_en: utc(2026, 9, 10),
        }),
      ]);

      const vigente = await service.planVigente(1, AHORA);

      // Sigue anclado al registro (13/08), no a la baja del 10/09.
      expect(vigente).toMatchObject({
        plan: 'GRATIS',
        periodoDesde: utc(2026, 9, 13),
        periodoHasta: utc(2026, 10, 13),
      });
    });
  });

  describe('verificar', () => {
    it('Gratis con su viaje del período usado: LIMITE_PLAN sugiriendo Base', async () => {
      prisma.consumo.count.mockResolvedValue(1);

      const error = await capturar(
        service.verificar(1, 'CREAR_VIAJE', undefined, AHORA),
      );

      expect(error).toBeInstanceOf(LimitePlanException);
      expect(error.getResponse()).toMatchObject({
        statusCode: 403,
        codigo: 'LIMITE_PLAN',
        accion: 'CREAR_VIAJE',
        planActual: 'GRATIS',
        planSugerido: 'BASE',
        limite: 1,
        usado: 1,
        renuevaEl: utc(2026, 10, 13),
      });
    });

    it('cuenta los viajes solo dentro del período vigente', async () => {
      await service.verificar(1, 'CREAR_VIAJE', undefined, AHORA);

      expect(prisma.consumo.count).toHaveBeenCalledWith({
        where: {
          id_usuario: 1,
          tipo: 'CREAR_VIAJE',
          creado_en: { gte: utc(2026, 9, 13), lt: utc(2026, 10, 13) },
        },
      });
    });

    it('un límite por viaje cuenta sobre ese viaje y no se renueva', async () => {
      prisma.consumo.count.mockResolvedValue(1);

      const error = await capturar(
        service.verificar(1, 'BUSCAR_ALOJAMIENTO', 7, AHORA),
      );

      expect(prisma.consumo.count).toHaveBeenCalledWith({
        where: { id_usuario: 1, tipo: 'BUSCAR_ALOJAMIENTO', id_viaje: 7 },
      });
      expect(error.getResponse()).toMatchObject({
        limite: 1,
        planSugerido: 'BASE',
        renuevaEl: null,
      });
    });

    it('lo que no incluye el plan se rechaza sin consultar el uso', async () => {
      const error = await capturar(
        service.verificar(1, 'REGENERAR_ITINERARIO', 7, AHORA),
      );

      expect(prisma.consumo.count).not.toHaveBeenCalled();
      expect(error.getResponse()).toMatchObject({
        limite: 0,
        planSugerido: 'BASE',
        message: 'Regenerar el itinerario no está incluido en el plan Gratis.',
      });
    });

    it('optimizar está bloqueado en Gratis y permitido en Base', async () => {
      const error = await capturar(
        service.verificar(1, 'OPTIMIZAR_DIA', 7, AHORA),
      );
      expect(error.getResponse()).toMatchObject({
        codigo: 'LIMITE_PLAN',
        planSugerido: 'BASE',
      });

      prisma.suscripcion.findMany.mockResolvedValue([suscripcion({})]);
      await expect(
        service.verificar(1, 'OPTIMIZAR_DIA', 7, AHORA),
      ).resolves.toBeUndefined();
    });

    it('en Base, agotada la búsqueda de vuelos sugiere Premium', async () => {
      prisma.suscripcion.findMany.mockResolvedValue([suscripcion({})]);
      prisma.consumo.count.mockResolvedValue(1);

      const error = await capturar(
        service.verificar(1, 'BUSCAR_VUELOS', 7, AHORA),
      );

      expect(error.getResponse()).toMatchObject({
        planActual: 'BASE',
        planSugerido: 'PREMIUM',
        limite: 1,
      });
    });

    it('en Premium, agotados los vuelos no hay plan que sugerir', async () => {
      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({ plan: 'PREMIUM' }),
      ]);
      prisma.consumo.count.mockResolvedValue(3);

      const error = await capturar(
        service.verificar(1, 'BUSCAR_VUELOS', 7, AHORA),
      );

      expect(error.getResponse()).toMatchObject({
        limite: 3,
        planSugerido: null,
      });
    });

    it('el tope diario frena aunque el plan no tenga límite, sin sugerir plan', async () => {
      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({ plan: 'PREMIUM' }),
      ]);
      prisma.consumo.count.mockImplementation(async (args: any) =>
        args.where.tipo?.in ? 10 : 0,
      );

      const error = await capturar(
        service.verificar(1, 'REGENERAR_ITINERARIO', 7, AHORA),
      );

      expect(error).toBeInstanceOf(TopeDiarioException);
      expect(error.getResponse()).toMatchObject({
        codigo: 'TOPE_DIARIO',
        limite: 10,
        usado: 10,
      });
      expect(error.getResponse()).not.toHaveProperty('planSugerido');
    });

    it('el tope de búsquedas suma vuelos y alojamiento en las últimas 24 horas', async () => {
      prisma.suscripcion.findMany.mockResolvedValue([
        suscripcion({ plan: 'PREMIUM' }),
      ]);

      await service.verificar(1, 'BUSCAR_ALOJAMIENTO', 7, AHORA);

      expect(prisma.consumo.count).toHaveBeenCalledWith({
        where: {
          id_usuario: 1,
          tipo: { in: ['BUSCAR_VUELOS', 'BUSCAR_ALOJAMIENTO'] },
          creado_en: { gte: utc(2026, 9, 13, 12) },
        },
      });
    });

    it('una acción por viaje sin id_viaje es un error de programación', async () => {
      await expect(
        service.verificar(1, 'BUSCAR_VUELOS', undefined, AHORA),
      ).rejects.toThrow('falta id_viaje');
    });
  });

  describe('registrar', () => {
    it('guarda el consumo con la base por defecto', async () => {
      await service.registrar(1, 'BUSCAR_VUELOS', 7);

      expect(prisma.consumo.create).toHaveBeenCalledWith({
        data: { id_usuario: 1, tipo: 'BUSCAR_VUELOS', id_viaje: 7 },
      });
    });

    it('usa la transacción que recibe, para confirmarse junto con la operación', async () => {
      const tx = { consumo: { create: jest.fn() } };

      await service.registrar(1, 'CREAR_VIAJE', undefined, tx as any);

      expect(tx.consumo.create).toHaveBeenCalledWith({
        data: { id_usuario: 1, tipo: 'CREAR_VIAJE', id_viaje: null },
      });
      expect(prisma.consumo.create).not.toHaveBeenCalled();
    });
  });

  describe('uso', () => {
    it('devuelve el plan, lo usado en el período y los contadores del viaje', async () => {
      prisma.consumo.count.mockImplementation(async (args: any) =>
        args.where.tipo === 'CREAR_VIAJE' ? 1 : 0,
      );

      const uso = await service.uso(1, 7, AHORA);

      expect(uso).toMatchObject({
        plan: 'GRATIS',
        nombrePlan: 'Gratis',
        viajes: { usado: 1, limite: 1 },
        viaje: {
          idViaje: 7,
          buscarAlojamiento: { usado: 0, limite: 1 },
          buscarVuelos: { usado: 0, limite: 0 },
          optimizar: false,
        },
        topeDiario: { itinerario: { limite: 10 }, busquedas: { limite: 20 } },
      });
    });
  });

  describe('catalogo', () => {
    it('lista los tres planes en orden con sus precios en pesos', () => {
      const { planes } = service.catalogo();

      expect(planes.map((p) => p.plan)).toEqual(['GRATIS', 'BASE', 'PREMIUM']);
      expect(planes.map((p) => p.precioMensualArs)).toEqual([
        0, 12_500, 38_500,
      ]);
    });
  });
});
