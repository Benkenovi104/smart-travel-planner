import { UnauthorizedException } from '@nestjs/common';
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import { PagosController } from './pagos.controller.js';

describe('PagosController', () => {
  let controller: PagosController;
  let mp: any;
  let suscripciones: any;
  const frontendOriginal = process.env.FRONTEND_URL;

  beforeEach(() => {
    mp = { firmaValida: jest.fn(() => true) };
    suscripciones = { procesarNotificacion: jest.fn(async () => undefined) };
    controller = new PagosController(mp, suscripciones);
  });

  afterEach(() => {
    if (frontendOriginal === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = frontendOriginal;
  });

  it('con firma inválida responde 401 y no procesa nada', async () => {
    mp.firmaValida.mockReturnValue(false);

    await expect(
      controller.webhook(
        'ts=1,v1=falsa',
        'req-1',
        { 'data.id': '123', type: 'subscription_preapproval' },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(suscripciones.procesarNotificacion).not.toHaveBeenCalled();
  });

  it('valida la firma con el data.id del query string y procesa ese recurso', async () => {
    const res = await controller.webhook(
      'ts=1,v1=x',
      'req-1',
      { 'data.id': 'abc', type: 'subscription_preapproval' },
      { type: 'otro', data: { id: 'otro' } },
    );

    expect(mp.firmaValida).toHaveBeenCalledWith({
      xSignature: 'ts=1,v1=x',
      xRequestId: 'req-1',
      dataId: 'abc',
    });
    expect(suscripciones.procesarNotificacion).toHaveBeenCalledWith(
      'subscription_preapproval',
      'abc',
    );
    expect(res).toEqual({ recibido: true });
  });

  it('si el query string no trae el id, usa el del cuerpo', async () => {
    await controller.webhook(
      'ts=1,v1=x',
      'req-1',
      {},
      { type: 'subscription_authorized_payment', data: { id: 9001 } },
    );

    expect(suscripciones.procesarNotificacion).toHaveBeenCalledWith(
      'subscription_authorized_payment',
      '9001',
    );
  });

  it('la vuelta del checkout redirige al frontend conservando los parámetros', () => {
    process.env.FRONTEND_URL = 'http://localhost:3001';

    expect(controller.volver({ preapproval_id: 'mp-1' })).toEqual({
      url: 'http://localhost:3001/planes/resultado?preapproval_id=mp-1',
      statusCode: 302,
    });
  });
});
