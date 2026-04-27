import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    const password_hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const usuario = await this.prisma.usuario.create({
      data: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        email: dto.email,
        password_hash,
        fecha_registro: new Date(),
      },
      select: {
        id_usuario: true,
        nombre: true,
        apellido: true,
        email: true,
        fecha_registro: true,
      },
    });

    const token = this.signToken(usuario.id_usuario, usuario.email);
    return { usuario, access_token: token };
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatch = await bcrypt.compare(dto.password, usuario.password_hash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { password_hash: _, ...usuarioSinPassword } = usuario;
    const token = this.signToken(usuario.id_usuario, usuario.email);

    return { usuario: usuarioSinPassword, access_token: token };
  }

  private signToken(id_usuario: number, email: string): string {
    const payload: JwtPayload = { sub: id_usuario, email };
    return this.jwtService.sign(payload);
  }
}
