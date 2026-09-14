import { createHmac } from 'node:crypto';
import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import { Invoice, MercadoPagoError } from 'mercadopago';
import { MercadoPagoService } from './mercado-pago.service.js';

const SECRETO = 'clave-de-webhooks-de-prueba';
const TS = '1789437600';

/** Firma como Mercado Pago: HMAC-SHA256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. */
const firmar = (dataId: string, requestId: string, secreto = SECRETO) => {
  const hash = createHmac('sha256', secreto)
    .update(`id:${dataId};request-id:${requestId};ts:${TS};`)
    .digest('hex');
  return `ts=${TS},v1=${hash}`;
};

describe('MercadoPagoService', () => {
  let service: MercadoPagoService;
  const original = {
    MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
    MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
  };

  beforeEach(() => {
    process.env.MP_WEBHOOK_SECRET = SECRETO;
    delete process.env.MP_ACCESS_TOKEN;
    service = new MercadoPagoService();
  });

  afterEach(() => {
    for (const [clave, valor] of Object.entries(original)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  });

  describe('firmaValida', () => {
    it('acepta una notificación firmada con nuestra clave', () => {
      expect(
        service.firmaValida({
          xSignature: firmar('123456', 'req-1'),
          xRequestId: 'req-1',
          dataId: '123456',
        }),
      ).toBe(true);
    });

    it('rechaza una firma hecha con otra clave', () => {
      expect(
        service.firmaValida({
          xSignature: firmar('123456', 'req-1', 'otra-clave'),
          xRequestId: 'req-1',
          dataId: '123456',
        }),
      ).toBe(false);
    });

    it('rechaza si cambiaron el id del recurso', () => {
      expect(
        service.firmaValida({
          xSignature: firmar('123456', 'req-1'),
          xRequestId: 'req-1',
          dataId: '999999',
        }),
      ).toBe(false);
    });

    it('rechaza una notificación sin firma', () => {
      expect(
        service.firmaValida({ xRequestId: 'req-1', dataId: '123456' }),
      ).toBe(false);
    });

    it('pasa a minúsculas los ids alfanuméricos, como los firma Mercado Pago', () => {
      expect(
        service.firmaValida({
          xSignature: firmar('abc123def', 'req-1'),
          xRequestId: 'req-1',
          dataId: 'ABC123DEF',
        }),
      ).toBe(true);
    });

    it('sin la clave configurada no puede validar: 503', () => {
      delete process.env.MP_WEBHOOK_SECRET;

      expect(() =>
        service.firmaValida({
          xSignature: firmar('123456', 'req-1'),
          xRequestId: 'req-1',
          dataId: '123456',
        }),
      ).toThrow(ServiceUnavailableException);
    });
  });

  it('sin Access Token los pagos responden 503 sin llamar a Mercado Pago', async () => {
    await expect(
      service.crearSuscripcion({
        idSuscripcion: 1,
        motivo: 'Smart Travel Planner — Plan Base',
        email: 'viajera@mail.com',
        monto: 12_500,
        urlRetorno: 'https://tunel.ngrok-free.dev/api/pagos/volver',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('listarCobros pagina de a 15, lo máximo que acepta la búsqueda de Mercado Pago', async () => {
    process.env.MP_ACCESS_TOKEN = 'TEST-token-de-prueba';
    const total = 20;
    const search = jest
      .spyOn(Invoice.prototype, 'search')
      .mockImplementation(async (datos: any) => {
        const { limit, offset } = datos.options;
        const cantidad = Math.max(0, Math.min(limit, total - offset));
        return {
          paging: { offset, limit, total },
          results: Array.from({ length: cantidad }, (_, i) => ({
            id: String(offset + i),
            preapproval_id: 'mp-1',
            payment: {
              id: '1',
              status: 'approved',
              status_detail: 'accredited',
            },
            transaction_amount: 12_500,
            debit_date: '2026-09-13T10:00:00.000-03:00',
          })),
        } as any;
      });

    try {
      const cobros = await service.listarCobros('mp-1');

      expect(search.mock.calls.map(([datos]: any) => datos.options)).toEqual([
        { preapproval_id: 'mp-1', limit: 15, offset: 0 },
        { preapproval_id: 'mp-1', limit: 15, offset: 15 },
      ]);
      expect(cobros).toHaveLength(20);
      expect(cobros[0]).toEqual({
        id: '0',
        idSuscripcionMp: 'mp-1',
        estadoPago: 'approved',
        monto: 12_500,
        fecha: new Date('2026-09-13T13:00:00.000Z'),
      });
    } finally {
      search.mockRestore();
    }
  });

  it('listarCobros ignora un cobro que llega sin id: no se podría registrar sin repetirlo', async () => {
    // Visto en el sandbox: un pago quedó guardado con mp_payment_id "undefined".
    process.env.MP_ACCESS_TOKEN = 'TEST-token-de-prueba';
    const aprobado = {
      id: '1',
      status: 'approved',
      status_detail: 'accredited',
    };
    const search = jest.spyOn(Invoice.prototype, 'search').mockResolvedValue({
      paging: { offset: 0, limit: 15, total: 2 },
      results: [
        {
          preapproval_id: 'mp-1',
          payment: aprobado,
          transaction_amount: 38_500,
        },
        {
          id: 7031934399,
          preapproval_id: 'mp-1',
          payment: aprobado,
          transaction_amount: 38_500,
        },
      ],
    } as any);

    try {
      const cobros = await service.listarCobros('mp-1');

      expect(cobros.map((c) => c.id)).toEqual(['7031934399']);
    } finally {
      search.mockRestore();
    }
  });

  describe('obtenerCobro', () => {
    it('devuelve null si el cobro no existe: el simulador del panel manda ids falsos', async () => {
      process.env.MP_ACCESS_TOKEN = 'TEST-token-de-prueba';
      const get = jest.spyOn(Invoice.prototype, 'get').mockRejectedValue(
        new MercadoPagoError({
          status: 404,
          message: 'The Authorized Payment with id 123456 does not exist',
        }),
      );

      try {
        await expect(service.obtenerCobro('123456')).resolves.toBeNull();
      } finally {
        get.mockRestore();
      }
    });

    it('también si el id ni siquiera tiene formato de cobro (400)', async () => {
      // Visto en vivo: el id de una suscripción consultado como cobro da 400.
      process.env.MP_ACCESS_TOKEN = 'TEST-token-de-prueba';
      const get = jest
        .spyOn(Invoice.prototype, 'get')
        .mockRejectedValue(
          new MercadoPagoError({ status: 400, message: 'bad_request_data' }),
        );

      try {
        await expect(
          service.obtenerCobro('0b1d763304af475d960b68280b11ef8b'),
        ).resolves.toBeNull();
      } finally {
        get.mockRestore();
      }
    });

    it('cualquier otro error de Mercado Pago sigue siendo 502', async () => {
      process.env.MP_ACCESS_TOKEN = 'TEST-token-de-prueba';
      const get = jest
        .spyOn(Invoice.prototype, 'get')
        .mockRejectedValue(
          new MercadoPagoError({ status: 500, message: 'Internal error' }),
        );

      try {
        await expect(service.obtenerCobro('7031934399')).rejects.toBeInstanceOf(
          BadGatewayException,
        );
      } finally {
        get.mockRestore();
      }
    });
  });
});
