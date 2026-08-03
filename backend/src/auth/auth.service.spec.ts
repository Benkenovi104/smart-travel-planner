import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    usuario: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwt: { sign: jest.Mock };
  let mail: { enviarResetPassword: jest.Mock };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = { sign: jest.fn(() => 'mock.jwt.token') };
    mail = { enviarResetPassword: jest.fn(async () => undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('crea el usuario y devuelve JWT cuando el email es nuevo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue({
        id_usuario: 1,
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@test.com',
      });

      const res = await service.register({
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@test.com',
        password: 'password123',
      });

      expect(res.access_token).toBe('mock.jwt.token');
      expect(res.usuario.email).toBe('juan@test.com');
      // el password nunca se guarda en texto plano
      const createArg = prisma.usuario.create.mock.calls[0][0] as any;
      expect(createArg.data.password_hash).not.toBe('password123');
      expect(createArg.data.password_hash).toEqual(expect.any(String));
    });

    it('lanza ConflictException si el email ya existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id_usuario: 1 });
      await expect(
        service.register({
          nombre: 'X',
          apellido: 'Y',
          email: 'dup@test.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('devuelve JWT con credenciales válidas', async () => {
      const hash = await bcrypt.hash('password123', 4);
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 1,
        email: 'juan@test.com',
        password_hash: hash,
      });

      const res = await service.login({
        email: 'juan@test.com',
        password: 'password123',
      });
      expect(res.access_token).toBe('mock.jwt.token');
      expect((res.usuario as any).password_hash).toBeUndefined();
    });

    it('lanza Unauthorized si el usuario no existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'no@test.com', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lanza Unauthorized si la contraseña no coincide', async () => {
      const hash = await bcrypt.hash('correcta', 4);
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 1,
        email: 'juan@test.com',
        password_hash: hash,
      });
      await expect(
        service.login({ email: 'juan@test.com', password: 'incorrecta' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('cambia la contraseña con la actual correcta', async () => {
      const hash = await bcrypt.hash('vieja123', 4);
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 1,
        password_hash: hash,
      });
      prisma.usuario.update.mockResolvedValue({});

      const res = await service.changePassword(1, {
        password_actual: 'vieja123',
        password_nueva: 'nueva456',
      });
      expect(res.message).toMatch(/actualizada/i);
      const updateArg = prisma.usuario.update.mock.calls[0][0] as any;
      const nuevoHash = updateArg.data.password_hash;
      expect(await bcrypt.compare('nueva456', nuevoHash)).toBe(true);
    });

    it('lanza Unauthorized si la contraseña actual es incorrecta', async () => {
      const hash = await bcrypt.hash('vieja123', 4);
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 1,
        password_hash: hash,
      });
      await expect(
        service.changePassword(1, {
          password_actual: 'equivocada',
          password_nueva: 'nueva456',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('con email inexistente responde genérico y NO manda mail', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      const res = await service.forgotPassword({ email: 'no@test.com' });
      expect(res.message).toMatch(/si el email está registrado/i);
      expect(mail.enviarResetPassword).not.toHaveBeenCalled();
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('con email existente guarda token hasheado y manda mail', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 7,
        email: 'juan@test.com',
      });
      prisma.usuario.update.mockResolvedValue({});

      const res = await service.forgotPassword({ email: 'juan@test.com' });
      expect(res.message).toMatch(/si el email está registrado/i);

      const updateArg = prisma.usuario.update.mock.calls[0][0] as any;
      expect(updateArg.data.reset_token_hash).toEqual(expect.any(String));
      expect(updateArg.data.reset_token_expira).toBeInstanceOf(Date);
      // el token va hasheado, no en claro
      expect(updateArg.data.reset_token_hash).toHaveLength(64); // sha256 hex

      expect(mail.enviarResetPassword).toHaveBeenCalledTimes(1);
      const [to, url] = mail.enviarResetPassword.mock.calls[0] as [
        string,
        string,
      ];
      expect(to).toBe('juan@test.com');
      expect(url).toContain('token=');
    });

    it('si falla el envío responde genérico igual, para no filtrar qué emails existen', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id_usuario: 7,
        email: 'juan@test.com',
      });
      prisma.usuario.update.mockResolvedValue({});
      mail.enviarResetPassword.mockRejectedValue(
        new Error('Invalid login: 535-5.7.8'),
      );

      const res = await service.forgotPassword({ email: 'juan@test.com' });
      // misma respuesta que para un email inexistente: sin esto, un 500 acá
      // delataría que la cuenta está registrada
      expect(res.message).toMatch(/si el email está registrado/i);
    });
  });

  describe('resetPassword', () => {
    it('con token inválido/vencido lanza BadRequest', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'basura', password_nueva: 'nueva456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('con token válido actualiza la contraseña y limpia el token', async () => {
      prisma.usuario.findFirst.mockResolvedValue({ id_usuario: 7 });
      prisma.usuario.update.mockResolvedValue({});

      const res = await service.resetPassword({
        token: 'token-valido',
        password_nueva: 'nueva456',
      });
      expect(res.message).toMatch(/restablecida/i);

      const updateArg = prisma.usuario.update.mock.calls[0][0] as any;
      expect(updateArg.data.reset_token_hash).toBeNull();
      expect(updateArg.data.reset_token_expira).toBeNull();
      expect(await bcrypt.compare('nueva456', updateArg.data.password_hash)).toBe(
        true,
      );
    });
  });
});
