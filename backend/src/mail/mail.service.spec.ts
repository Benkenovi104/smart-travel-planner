import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import { InternalServerErrorException } from '@nestjs/common';
import { MailService } from './mail.service.js';

/**
 * Lo que se prueba acá es **por dónde sale** el mail, no el contenido.
 *
 * Importa porque Render bloquea los puertos SMTP en el plan free: si en
 * producción el servicio se cayera a SMTP por un error de configuración, los
 * envíos morirían con ENETUNREACH y sólo se vería en los logs.
 */
describe('MailService', () => {
  let service: MailService;
  let fetchMock: jest.Mock;
  const envOriginal = { ...process.env };

  beforeEach(() => {
    process.env.MAIL_FROM = 'hola@midominio.com';
    delete process.env.BREVO_API_KEY;
    fetchMock = jest.fn(() =>
      Promise.resolve({ ok: true, status: 201 } as Response),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new MailService();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  describe('con BREVO_API_KEY', () => {
    beforeEach(() => {
      process.env.BREVO_API_KEY = 'la-key';
    });

    it('manda por la API HTTP y no toca SMTP', async () => {
      await service.enviarCodigoVerificacion('juan@test.com', '481203', 24);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      expect((init.headers as Record<string, string>)['api-key']).toBe(
        'la-key',
      );
    });

    it('manda el remitente con nombre y el código en el asunto', async () => {
      await service.enviarCodigoVerificacion('juan@test.com', '481203', 24);

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(init.body as string) as {
        sender: { name: string; email: string };
        to: { email: string }[];
        subject: string;
      };
      expect(body.sender).toEqual({
        name: 'Smart Travel Planner',
        email: 'hola@midominio.com',
      });
      expect(body.to).toEqual([{ email: 'juan@test.com' }]);
      expect(body.subject).toContain('481203');
    });

    it('un rechazo de la API se convierte en error, no pasa por éxito', async () => {
      // El caso real: la dirección de MAIL_FROM no está verificada en Brevo, o
      // la cuenta todavía no pasó la aprobación manual del alta.
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('{"message":"sender not valid"}'),
      } as unknown as Response);

      await expect(
        service.enviarCodigoVerificacion('juan@test.com', '481203', 24),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('el detalle del proveedor no viaja al cliente', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('sender not valid'),
      } as unknown as Response);

      const error = await service
        .enviarCodigoVerificacion('juan@test.com', '481203', 24)
        .catch((e: Error) => e);

      expect(error.message).toBe('No se pudo enviar el código de verificación');
      expect(error.message).not.toContain('sender');
    });
  });

  describe('sin BREVO_API_KEY', () => {
    it('cae a SMTP: no le pega a la API de Brevo', async () => {
      // Apunta a un puerto cerrado local: el test no debe salir a la red ni
      // depender de Gmail para probar por dónde enruta.
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_PORT = '1';
      process.env.SMTP_USER = 'x@test.com';
      process.env.SMTP_PASS = 'y';

      // Sin servidor SMTP el envío falla, que es lo esperable acá; lo que se
      // comprueba es que no haya salido por HTTP.
      await service
        .enviarCodigoVerificacion('juan@test.com', '481203', 24)
        .catch(() => undefined);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sin credenciales SMTP avisa que falta configuración', async () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      await expect(
        service.enviarCodigoVerificacion('juan@test.com', '481203', 24),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
