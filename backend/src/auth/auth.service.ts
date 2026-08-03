import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const MENSAJE_FORGOT_GENERICO =
  'Si el email está registrado, te enviamos un enlace para restablecer la contraseña.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

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

    const passwordMatch = await bcrypt.compare(
      dto.password,
      usuario.password_hash,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { password_hash: _, ...usuarioSinPassword } = usuario;
    const token = this.signToken(usuario.id_usuario, usuario.email);

    return { usuario: usuarioSinPassword, access_token: token };
  }

  async changePassword(id_usuario: number, dto: ChangePasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario },
    });
    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    const actualOk = await bcrypt.compare(
      dto.password_actual,
      usuario.password_hash,
    );
    if (!actualOk) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const password_hash = await bcrypt.hash(dto.password_nueva, SALT_ROUNDS);
    await this.prisma.usuario.update({
      where: { id_usuario },
      data: { password_hash },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    // Respuesta genérica siempre: no revelamos si el email existe o no.
    if (!usuario) return { message: MENSAJE_FORGOT_GENERICO };

    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: {
        reset_token_hash: this.hashToken(rawToken),
        reset_token_expira: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    // Si el envío falla, lo registramos pero devolvemos igual la respuesta
    // genérica: un 500 acá sólo se daría para emails que existen, y eso
    // permitiría enumerar qué cuentas están registradas.
    try {
      await this.mail.enviarResetPassword(usuario.email, resetUrl);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No se pudo enviar el email de reseteo a ${usuario.email}: ${mensaje}`,
      );
    }

    return { message: MENSAJE_FORGOT_GENERICO };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        reset_token_hash: this.hashToken(dto.token),
        reset_token_expira: { gt: new Date() },
      },
    });
    if (!usuario) {
      throw new BadRequestException('Token inválido o vencido');
    }

    const password_hash = await bcrypt.hash(dto.password_nueva, SALT_ROUNDS);
    await this.prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: {
        password_hash,
        reset_token_hash: null,
        reset_token_expira: null,
      },
    });

    return { message: 'Contraseña restablecida correctamente' };
  }

  private signToken(id_usuario: number, email: string): string {
    const payload: JwtPayload = { sub: id_usuario, email };
    return this.jwtService.sign(payload);
  }
}
