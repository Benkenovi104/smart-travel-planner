import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import { SuscripcionesService } from './suscripciones.service.js';
import { type CobroMp, MercadoPagoService } from './mercado-pago.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const utc = (anio: number, mes: number, dia: number, hora = 0) =>
  new Date(Date.UTC(anio, mes - 1, dia, hora));

const AHORA = utc(2026, 9, 14, 12);

const cobro = (datos: Partial<CobroMp> = {}): CobroMp => ({
  id: '9001',
  idSuscripcionMp: 'mp-1',
  estadoPago: 'approved',
  monto: 12_500,
  fecha: utc(2026, 9, 1),
  ...datos,
});

/** Una suscripción recién creada y todavía sin pagar. */
const fila = (datos: Record<string, unknown> = {}) => ({
  id_suscripcion: 1,
  id_usuario: 7,
  plan: 'BASE',
  estado: 'PENDIENTE',
  mp_preapproval_id: 'mp-1',
  dia_ancla: utc(2026, 8, 13, 14),
  vigente_desde: null,
  vigente_hasta: null,
  cancelada_en: null,
  creada_en: utc(2026, 8, 13, 14),
  ...datos,
});

const VARIABLES = ['MP_BACK_URL', 'MP_PAYER_EMAIL_PRUEBA', 'FRONTEND_URL'];

describe('SuscripcionesService', () => {
  let service: SuscripcionesService;
  let prisma: any;
  let mp: any;
  /**
   * La base en memoria: la suscripción que se procesa, sus pagos, y lo que
   * devuelven las demás consultas de suscripciones del usuario.
   */
  let db: { suscripcion: any; pagos: any[]; otras: any[] };
  let entorno: Record<string, string | undefined>;

  beforeEach(async () => {
    entorno = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
    delete process.env.MP_BACK_URL;
    delete process.env.MP_PAYER_EMAIL_PRUEBA;
    process.env.FRONTEND_URL = 'http://localhost:3001';

    db = { suscripcion: fila(), pagos: [], otras: [] };
    const esLaFila = (where: any) =>
      where.id_suscripcion === db.suscripcion.id_suscripcion;

    prisma = {
      usuario: {
        findUnique: jest.fn(async () => ({ email: 'viajera@mail.com' })),
      },
      suscripcion: {
        findMany: jest.fn(async ({ where }: any) =>
          where.estado === 'PENDIENTE'
            ? db.suscripcion.estado === 'PENDIENTE'
              ? [db.suscripcion]
              : []
            : db.otras,
        ),
        findUnique: jest.fn(async ({ where }: any) =>
          where.mp_preapproval_id === db.suscripcion.mp_preapproval_id
            ? db.suscripcion
            : null,
        ),
        findFirst: jest.fn(async ({ where }: any) =>
          esLaFila(where) && where.id_usuario === db.suscripcion.id_usuario
            ? db.suscripcion
            : null,
        ),
        findUniqueOrThrow: jest.fn(async () => db.suscripcion),
        create: jest.fn(async () => ({ id_suscripcion: 1 })),
        update: jest.fn(async ({ where, data }: any) =>
          esLaFila(where) ? Object.assign(db.suscripcion, data) : {},
        ),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (!esLaFila(where) || db.suscripcion.estado === 'CANCELADA') {
            return { count: 0 };
          }
          Object.assign(db.suscripcion, data);
          return { count: 1 };
        }),
        delete: jest.fn(async () => ({})),
      },
      pagoSuscripcion: {
        findUnique: jest.fn(
          async ({ where }: any) =>
            db.pagos.find((p) => p.mp_payment_id === where.mp_payment_id) ??
            null,
        ),
        findFirst: jest.fn(async () => db.pagos.at(-1) ?? null),
        create: jest.fn(async ({ data }: any) => {
          db.pagos.push({ ...data, creado_en: new Date() });
          return data;
        }),
        update: jest.fn(async ({ where, data }: any) =>
          Object.assign(
            db.pagos.find((p) => p.mp_payment_id === where.mp_payment_id),
            data,
          ),
        ),
      },
      $queryRaw: jest.fn(async () => []),
    };
    // La transacción corre sobre el mismo mock: alcanza para ver qué se escribe.
    prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));

    mp = {
      crearSuscripcion: jest.fn(async () => ({
        id: 'mp-nueva',
        initPoint:
          'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=mp-nueva',
      })),
      obtenerSuscripcion: jest.fn(async () => ({
        id: 'mp-1',
        status: 'authorized',
      })),
      cancelarSuscripcion: jest.fn(async () => undefined),
      obtenerCobro: jest.fn(async () => cobro()),
      listarCobros: jest.fn(async () => []),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuscripcionesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MercadoPagoService, useValue: mp },
      ],
    }).compile();
    service = module.get<SuscripcionesService>(SuscripcionesService);
  });

  afterEach(() => {
    for (const v of VARIABLES) {
      if (entorno[v] === undefined) delete process.env[v];
      else process.env[v] = entorno[v];
    }
  });

  describe('suscribir', () => {
    beforeEach(() => {
      // Sin checkouts pendientes de antes.
      db.suscripcion = fila({
        id_suscripcion: 99,
        estado: 'VENCIDA',
        mp_preapproval_id: null,
      });
    });

    it('crea la suscripción pendiente y pide el link de pago con el precio en pesos', async () => {
      const res = await service.suscribir(7, 'BASE', AHORA);

      expect(prisma.suscripcion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            id_usuario: 7,
            plan: 'BASE',
            estado: 'PENDIENTE',
            dia_ancla: AHORA,
          },
        }),
      );
      expect(mp.crearSuscripcion).toHaveBeenCalledWith({
        idSuscripcion: 1,
        motivo: 'Smart Travel Planner — Plan Base',
        email: 'viajera@mail.com',
        monto: 12_500,
        urlRetorno: 'http://localhost:3001/planes/resultado',
      });
      expect(prisma.suscripcion.update).toHaveBeenCalledWith({
        where: { id_suscripcion: 1 },
        data: { mp_preapproval_id: 'mp-nueva' },
      });
      expect(res).toEqual({
        idSuscripcion: 1,
        initPoint: expect.stringContaining('preapproval_id=mp-nueva'),
      });
    });

    it('en pruebas usa la cuenta compradora y la URL de retorno configuradas', async () => {
      process.env.MP_PAYER_EMAIL_PRUEBA = 'test_user_1@testuser.com';
      process.env.MP_BACK_URL = 'https://tunel.ngrok-free.dev/api/pagos/volver';

      await service.suscribir(7, 'PREMIUM', AHORA);

      expect(mp.crearSuscripcion).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test_user_1@testuser.com',
          urlRetorno: 'https://tunel.ngrok-free.dev/api/pagos/volver',
          monto: 38_500,
        }),
      );
    });

    it('no deja suscribirse al mismo plan ni a uno menor mientras se cobra otro', async () => {
      db.otras = [{ plan: 'PREMIUM', vigente_hasta: utc(2026, 10, 1) }];

      await expect(service.suscribir(7, 'PREMIUM', AHORA)).rejects.toThrow(
        'Ya tenés el plan Premium.',
      );
      await expect(service.suscribir(7, 'BASE', AHORA)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mp.crearSuscripcion).not.toHaveBeenCalled();
    });

    it('deja subir de plan sin cancelar todavía el anterior', async () => {
      db.otras = [{ plan: 'BASE', vigente_hasta: utc(2026, 10, 1) }];

      await service.suscribir(7, 'PREMIUM', AHORA);

      expect(mp.crearSuscripcion).toHaveBeenCalled();
      expect(mp.cancelarSuscripcion).not.toHaveBeenCalled();
    });

    it('una paga que venció hace rato no bloquea', async () => {
      db.otras = [{ plan: 'BASE', vigente_hasta: utc(2026, 8, 1) }];

      await service.suscribir(7, 'BASE', AHORA);

      expect(mp.crearSuscripcion).toHaveBeenCalled();
    });

    it('si Mercado Pago falla, borra la fila pendiente y propaga el error', async () => {
      mp.crearSuscripcion.mockRejectedValue(new BadGatewayException('caído'));

      await expect(service.suscribir(7, 'BASE', AHORA)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(prisma.suscripcion.delete).toHaveBeenCalledWith({
        where: { id_suscripcion: 1 },
      });
      expect(prisma.suscripcion.update).not.toHaveBeenCalled();
    });

    it('da de baja un checkout abandonado antes de crear otro', async () => {
      db.suscripcion = fila({
        id_suscripcion: 5,
        mp_preapproval_id: 'mp-vieja',
      });
      mp.obtenerSuscripcion.mockResolvedValue({
        id: 'mp-vieja',
        status: 'pending',
      });

      await service.suscribir(7, 'BASE', AHORA);

      expect(mp.cancelarSuscripcion).toHaveBeenCalledWith('mp-vieja');
      expect(db.suscripcion.estado).toBe('CANCELADA');
      expect(mp.crearSuscripcion).toHaveBeenCalled();
    });
  });

  describe('notificaciones de Mercado Pago', () => {
    it('el primer cobro aprobado activa el plan, anclado al día del pago', async () => {
      mp.listarCobros.mockResolvedValue([
        cobro({ fecha: utc(2026, 8, 13, 15) }),
      ]);

      await service.procesarNotificacion('subscription_preapproval', 'mp-1');

      expect(db.suscripcion).toMatchObject({
        estado: 'ACTIVA',
        dia_ancla: utc(2026, 8, 13, 15),
        vigente_desde: utc(2026, 8, 13, 15),
        vigente_hasta: utc(2026, 9, 13, 15),
      });
      expect(db.pagos).toEqual([
        expect.objectContaining({
          id_suscripcion: 1,
          mp_payment_id: '9001',
          estado: 'approved',
          monto: 12_500,
          periodo_desde: utc(2026, 8, 13, 15),
          periodo_hasta: utc(2026, 9, 13, 15),
        }),
      ]);
      // Bloquea la fila: dos notificaciones simultáneas no extienden dos veces.
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('la misma notificación dos veces registra un solo pago y extiende una sola vez', async () => {
      mp.listarCobros.mockResolvedValue([
        cobro({ fecha: utc(2026, 8, 13, 15) }),
      ]);

      await service.procesarNotificacion('subscription_preapproval', 'mp-1');
      await service.procesarNotificacion('subscription_preapproval', 'mp-1');

      expect(db.pagos).toHaveLength(1);
      expect(db.suscripcion.vigente_hasta).toEqual(utc(2026, 9, 13, 15));
    });

    it('la notificación de un cobro sirve aunque la búsqueda todavía no lo traiga', async () => {
      mp.obtenerCobro.mockResolvedValue(
        cobro({ id: '9003', fecha: utc(2026, 8, 13, 15) }),
      );

      await service.procesarNotificacion(
        'subscription_authorized_payment',
        '9003',
      );

      expect(mp.obtenerCobro).toHaveBeenCalledWith('9003');
      expect(mp.obtenerSuscripcion).toHaveBeenCalledWith('mp-1');
      expect(db.suscripcion.estado).toBe('ACTIVA');
      expect(db.pagos[0].mp_payment_id).toBe('9003');
    });

    it('una renovación pagada en la gracia vuelve a ACTIVA y sigue desde donde terminaba lo pagado', async () => {
      db.suscripcion = fila({
        estado: 'EN_GRACIA',
        dia_ancla: utc(2026, 8, 13),
        vigente_desde: utc(2026, 8, 13),
        vigente_hasta: utc(2026, 9, 13),
      });
      mp.listarCobros.mockResolvedValue([
        cobro({ id: '9002', fecha: utc(2026, 9, 14) }),
      ]);

      await service.procesarNotificacion('subscription_preapproval', 'mp-1');

      expect(db.suscripcion).toMatchObject({
        estado: 'ACTIVA',
        dia_ancla: utc(2026, 8, 13),
        vigente_hasta: utc(2026, 10, 13),
      });
    });

    it('un cobro rechazado pasa a gracia sin extender, y el reintento aprobado lo reactiva', async () => {
      db.suscripcion = fila({
        estado: 'ACTIVA',
        dia_ancla: utc(2026, 8, 13),
        vigente_desde: utc(2026, 8, 13),
        vigente_hasta: utc(2026, 9, 13),
      });
      mp.listarCobros.mockResolvedValue([
        cobro({ id: '9002', estadoPago: 'rejected', fecha: utc(2026, 9, 13) }),
      ]);

      await service.procesarNotificacion('subscription_preapproval', 'mp-1');

      expect(db.suscripcion).toMatchObject({
        estado: 'EN_GRACIA',
        vigente_hasta: utc(2026, 9, 13),
      });
      expect(db.pagos).toEqual([
        expect.objectContaining({ mp_payment_id: '9002', estado: 'rejected' }),
      ]);

      mp.listarCobros.mockResolvedValue([
        cobro({ id: '9002', estadoPago: 'approved', fecha: utc(2026, 9, 13) }),
      ]);
      await service.procesarNotificacion('subscription_preapproval', 'mp-1');

      expect(db.suscripcion).toMatchObject({
        estado: 'ACTIVA',
        vigente_hasta: utc(2026, 10, 13),
      });
      expect(db.pagos).toEqual([
        expect.objectContaining({ mp_payment_id: '9002', estado: 'approved' }),
      ]);
    });

    it('cancelada desde Mercado Pago queda CANCELADA y conserva lo pagado', async () => {
      db.suscripcion = fila({
        estado: 'ACTIVA',
        vigente_desde: utc(2026, 9, 1),
        vigente_hasta: utc(2026, 10, 1),
      });
      mp.obtenerSuscripcion.mockResolvedValue({
        id: 'mp-1',
        status: 'cancelled',
      });

      await service.procesarNotificacion('subscription_preapproval', 'mp-1');

      expect(db.suscripcion).toMatchObject({
        estado: 'CANCELADA',
        vigente_hasta: utc(2026, 10, 1),
        cancelada_en: expect.any(Date),
      });
      expect(mp.cancelarSuscripcion).not.toHaveBeenCalled();
    });

    it('subida de plan: recién cuando se paga la nueva, cancela la anterior', async () => {
      db.suscripcion = fila({ plan: 'PREMIUM' });
      db.otras = [{ id_suscripcion: 2, mp_preapproval_id: 'mp-base' }];

      await service.procesarNotificacion('subscription_preapproval', 'mp-1');
      expect(mp.cancelarSuscripcion).not.toHaveBeenCalled();

      mp.listarCobros.mockResolvedValue([cobro({ monto: 38_500 })]);
      await service.procesarNotificacion('subscription_preapproval', 'mp-1');

      expect(mp.cancelarSuscripcion).toHaveBeenCalledWith('mp-base');
      expect(prisma.suscripcion.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id_usuario: 7,
            id_suscripcion: { not: 1 },
            creada_en: { lt: db.suscripcion.creada_en },
          }),
        }),
      );
      expect(prisma.suscripcion.updateMany).toHaveBeenCalledWith({
        where: { id_suscripcion: 2, estado: { not: 'CANCELADA' } },
        data: { estado: 'CANCELADA', cancelada_en: expect.any(Date) },
      });
    });

    it('ignora suscripciones que no son de la app', async () => {
      await service.procesarNotificacion(
        'subscription_preapproval',
        'mp-desconocida',
      );

      expect(mp.obtenerSuscripcion).not.toHaveBeenCalled();
    });

    it('ignora los tipos de notificación que no usa', async () => {
      await service.procesarNotificacion('payment', '123');

      expect(mp.obtenerSuscripcion).not.toHaveBeenCalled();
      expect(mp.obtenerCobro).not.toHaveBeenCalled();
    });
  });

  describe('cancelar', () => {
    const activa = {
      id_suscripcion: 3,
      mp_preapproval_id: 'mp-3',
      estado: 'ACTIVA',
      vigente_hasta: utc(2026, 10, 13),
    };

    it('cancela en Mercado Pago y después en la base, sin tocar hasta cuándo está pago', async () => {
      db.otras = [activa];

      const res = await service.cancelar(7);

      expect(mp.cancelarSuscripcion).toHaveBeenCalledWith('mp-3');
      expect(prisma.suscripcion.updateMany).toHaveBeenCalledWith({
        where: { id_suscripcion: 3, estado: { not: 'CANCELADA' } },
        data: { estado: 'CANCELADA', cancelada_en: expect.any(Date) },
      });
      expect(res.vigenteHasta).toEqual(utc(2026, 10, 13));
    });

    it('sin suscripción paga responde 404', async () => {
      await expect(service.cancelar(7)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('si Mercado Pago falla, no la marca cancelada', async () => {
      db.otras = [activa];
      mp.cancelarSuscripcion.mockRejectedValue(
        new BadGatewayException('caído'),
      );

      await expect(service.cancelar(7)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(prisma.suscripcion.updateMany).not.toHaveBeenCalled();
    });

    it('cancelarTodas no llama a Mercado Pago si no hay nada que cancelar', async () => {
      await service.cancelarTodas(7);

      expect(mp.cancelarSuscripcion).not.toHaveBeenCalled();
    });
  });

  describe('estado', () => {
    it('si sigue pendiente, la sincroniza con Mercado Pago antes de responder', async () => {
      mp.listarCobros.mockResolvedValue([
        cobro({ fecha: utc(2026, 8, 13, 15) }),
      ]);

      const res = await service.estado(7, 1);

      expect(res).toMatchObject({
        idSuscripcion: 1,
        plan: 'BASE',
        nombrePlan: 'Base',
        estado: 'ACTIVA',
        ultimoPago: { estado: 'approved' },
      });
    });

    it('abrir la página de retorno sin pagar no activa nada', async () => {
      mp.obtenerSuscripcion.mockResolvedValue({
        id: 'mp-1',
        status: 'pending',
      });

      const res = await service.estado(7, 1);

      expect(res).toMatchObject({ estado: 'PENDIENTE', ultimoPago: null });
    });

    it('no muestra suscripciones de otro usuario', async () => {
      await expect(service.estado(8, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mp.obtenerSuscripcion).not.toHaveBeenCalled();
    });
  });
});
