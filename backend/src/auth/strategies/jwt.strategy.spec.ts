import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: any;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    prisma = { usuario: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: PrismaService, useValue: prisma }],
    }).compile();
    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('devuelve el usuario si existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      email: 'a@b.com',
    });

    await expect(strategy.validate({ sub: 1, email: 'a@b.com' })).resolves.toEqual(
      { id_usuario: 1, email: 'a@b.com' },
    );
  });

  it('rechaza el token de una cuenta borrada', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 99, email: 'borrado@b.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('toma el email de la base, no del payload (puede haber cambiado)', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      email: 'nuevo@b.com',
    });

    const user = await strategy.validate({ sub: 1, email: 'viejo@b.com' });
    expect(user.email).toBe('nuevo@b.com');
  });
});
