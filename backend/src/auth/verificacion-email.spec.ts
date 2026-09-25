import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { JwtService } from '@nestjs/jwt';

const hash = (v: string) => createHash('sha256').update(v).digest('hex');

describe('AuthService · verificación de email', () => {
  let service: AuthService;
  let prisma: any;
  let mail: { enviarCodigoVerificacion: jest.Mock };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(async () => ({})),
      },
    };
    mail = { enviarCodigoVerificacion: jest.fn(async () => undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'jwt') } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  const registrar = () =>
    service.register({
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@test.com',
      password: 'Password123!',
    });

  describe('al registrarse', () => {
    beforeEach(() => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue({
        id_usuario: 7,
        email: 'juan@test.com',
        email_verificado: false,
      });
    });

    it('manda un código de 6 dígitos', async () => {
      await registrar();

      const [email, codigo] = mail.enviarCodigoVerificacion.mock.calls[0] as [
        string,
        string,
        number,
      ];
      expect(email).toBe('juan@test.com');
      expect(codigo).toMatch(/^\d{6}$/);
    });

    it('guarda el hash del código y no el código', async () => {
      // Una base filtrada no debería servir para verificar cuentas ajenas.
      await registrar();

      const codigo = mail.enviarCodigoVerificacion.mock.calls[0][1] as string;
      const arg = prisma.usuario.update.mock.calls[0][0];
      expect(arg.data.verif_token_hash).toBe(hash(codigo));
      expect(arg.data.verif_token_hash).not.toBe(codigo);
    });

    it('si el mail no sale, la cuenta igual queda creada', async () => {
      // Abortar el alta por un SMTP caído sería peor que dejarla sin verificar:
      // el usuario siempre puede pedir el código de nuevo.
      mail.enviarCodigoVerificacion.mockRejectedValue(new Error('SMTP caído'));

      await expect(registrar()).resolves.toMatchObject({
        access_token: 'jwt',
      });
    });
  });

  describe('verificarEmail', () => {
    it('con el código correcto marca la cuenta y quema el código', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 7,
        email_verificado: false,
        verif_token_hash: hash('481203'),
        verif_token_expira: new Date(Date.now() + 60_000),
      });

      const res = await service.verificarEmail(7, '481203');

      expect(res.email_verificado).toBe(true);
      const arg = prisma.usuario.update.mock.calls[0][0];
      expect(arg.data.email_verificado).toBe(true);
      expect(arg.data.verif_token_hash).toBeNull();
    });

    it('rechaza un código equivocado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 7,
        email_verificado: false,
        verif_token_hash: hash('111111'),
        verif_token_expira: new Date(Date.now() + 60_000),
      });

      await expect(service.verificarEmail(7, '999999')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('rechaza el código correcto si ya venció', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 7,
        email_verificado: false,
        verif_token_hash: hash('481203'),
        verif_token_expira: new Date(Date.now() - 1),
      });

      await expect(service.verificarEmail(7, '481203')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sobre una cuenta ya verificada no es error ni vuelve a escribir', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 7,
        email_verificado: true,
      });

      const res = await service.verificarEmail(7, '000000');

      expect(res.email_verificado).toBe(true);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
  });

  describe('reenviarVerificacion', () => {
    it('genera un código nuevo, dejando inservible el anterior', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 7,
        email: 'juan@test.com',
        email_verificado: false,
        verif_token_hash: 'hash-viejo',
      });

      await service.reenviarVerificacion(7);

      const arg = prisma.usuario.update.mock.calls[0][0];
      expect(arg.data.verif_token_hash).not.toBe('hash-viejo');
      expect(mail.enviarCodigoVerificacion).toHaveBeenCalledTimes(1);
    });

    it('sobre una cuenta ya verificada no manda nada', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 7,
        email_verificado: true,
      });

      await service.reenviarVerificacion(7);

      expect(mail.enviarCodigoVerificacion).not.toHaveBeenCalled();
    });
  });
});
