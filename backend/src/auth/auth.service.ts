import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt, createHash } from 'crypto';
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
const VERIF_HORAS = 24;
const VERIF_TOKEN_TTL_MS = VERIF_HORAS * 60 * 60 * 1000;
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

  /**
   * Los campos del usuario que pueden salir del backend.
   *
   * Se enumera lo que se muestra en vez de quitar lo que no: con un
   * `const { password_hash, ...resto }` la fila entera queda expuesta por
   * defecto y cada columna nueva se filtra sola. Así pasaba con
   * `reset_token_hash`, que viajaba en la respuesta del login.
   */
  private publico(usuario: {
    id_usuario: number;
    nombre: string | null;
    apellido: string | null;
    email: string;
    fecha_registro: Date;
    email_verificado: boolean;
  }) {
    return {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      fecha_registro: usuario.fecha_registro,
      email_verificado: usuario.email_verificado,
    };
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
        email_verificado: true,
      },
    });

    // El alta no se cae si el mail no sale: la cuenta queda creada y sin
    // verificar, y el usuario puede pedir el código de nuevo desde la app.
    // Abortar el registro por un SMTP caído sería mucho peor.
    await this.mandarCodigoVerificacion(usuario.id_usuario, usuario.email);

    const token = this.signToken(usuario.id_usuario, usuario.email);
    return { usuario, access_token: token };
  }

  /**
   * Genera un código nuevo, lo guarda hasheado y lo manda por mail. Pisa el
   * anterior a propósito: si alguien pide reenviar, el viejo deja de servir.
   */
  private async mandarCodigoVerificacion(
    id_usuario: number,
    email: string,
  ): Promise<void> {
    // 6 dígitos con randomInt, que es criptográficamente seguro. Math.random()
    // sería adivinable conociendo el momento del registro.
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');

    await this.prisma.usuario.update({
      where: { id_usuario },
      data: {
        verif_token_hash: this.hashToken(codigo),
        verif_token_expira: new Date(Date.now() + VERIF_TOKEN_TTL_MS),
      },
    });

    try {
      await this.mail.enviarCodigoVerificacion(email, codigo, VERIF_HORAS);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `No se pudo enviar el código de verificación a ${email}: ${mensaje}`,
      );
    }
  }

  async verificarEmail(id_usuario: number, codigo: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario },
    });
    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    if (usuario.email_verificado) {
      // Idempotente: reintentar con el código ya usado no es un error para el
      // usuario, que lo único que quiere saber es si su cuenta está lista.
      return {
        message: 'El email ya estaba verificado',
        email_verificado: true,
      };
    }

    const vigente =
      usuario.verif_token_hash === this.hashToken(codigo) &&
      usuario.verif_token_expira !== null &&
      usuario.verif_token_expira.getTime() > Date.now();

    if (!vigente) {
      throw new BadRequestException('Código inválido o vencido');
    }

    await this.prisma.usuario.update({
      where: { id_usuario },
      data: {
        email_verificado: true,
        verif_token_hash: null,
        verif_token_expira: null,
      },
    });

    return {
      message: 'Email verificado correctamente',
      email_verificado: true,
    };
  }

  async reenviarVerificacion(id_usuario: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario },
    });
    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    if (usuario.email_verificado) {
      return {
        message: 'El email ya estaba verificado',
        email_verificado: true,
      };
    }

    await this.mandarCodigoVerificacion(usuario.id_usuario, usuario.email);
    return { message: 'Te mandamos un código nuevo', email_verificado: false };
  }

  /**
   * Corrige la dirección de una cuenta que todavía no verificó.
   *
   * Sin esto, equivocarse tipeando el email al registrarse deja la cuenta
   * muerta: el código se manda a una casilla que no es tuya (o que no existe) y
   * no se puede hacer nada, porque sin verificar el backend rechaza hasta crear
   * un viaje. Reenviar no ayuda: vuelve a ir a la dirección equivocada.
   *
   * Sólo mientras no esté verificada. Cambiar el email de una cuenta ya
   * confirmada es otra cosa —habría que pedir la contraseña y avisar a la
   * dirección vieja, porque es un vector de secuestro de cuenta— y no se
   * resuelve acá.
   */
  async cambiarEmailSinVerificar(id_usuario: number, email: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario },
    });
    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    if (usuario.email_verificado) {
      throw new BadRequestException(
        'Tu email ya está verificado. Para cambiarlo, escribinos.',
      );
    }

    if (email !== usuario.email) {
      const ocupado = await this.prisma.usuario.findUnique({
        where: { email },
      });
      if (ocupado) throw new ConflictException('El email ya está registrado');

      await this.prisma.usuario.update({
        where: { id_usuario },
        data: { email },
      });
    }

    await this.mandarCodigoVerificacion(id_usuario, email);
    return { message: `Te mandamos un código a ${email}`, email };
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

    const token = this.signToken(usuario.id_usuario, usuario.email);

    return { usuario: this.publico(usuario), access_token: token };
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

    // Respuesta genérica siempre: si acá devolviéramos un 404, cualquiera
    // podría probar direcciones y averiguar cuáles tienen cuenta. Para que el
    // dueño de la casilla igual se entere, se le avisa por mail —que sólo puede
    // leer él— en vez de por la respuesta HTTP, que puede leer cualquiera.
    if (!usuario) {
      this.logger.warn(
        `Pedido de reseteo para un email sin cuenta: ${dto.email}`,
      );
      try {
        await this.mail.enviarCuentaInexistente(dto.email);
      } catch {
        // Ya lo logueó MailService. No se propaga: un 500 sólo para las
        // direcciones sin cuenta delataría, por descarte, cuáles sí existen.
      }
      return { message: MENSAJE_FORGOT_GENERICO };
    }

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
