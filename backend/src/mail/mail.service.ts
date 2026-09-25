import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  /**
   * Crea (una sola vez) el transporter SMTP a partir de las env vars. Gmail:
   * SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=<tu@gmail.com>,
   * SMTP_PASS=<app password de 16 chars, con 2FA activo>. Si falta config,
   * lanza un error claro en vez de fallar silenciosamente.
   */
  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST ?? 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      throw new InternalServerErrorException(
        'Envío de email no configurado (faltan SMTP_USER / SMTP_PASS)',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = SSL directo; 587 = STARTTLS
      auth: { user, pass },
      connectionTimeout: 10_000, // 10s límite para conectar con el servidor SMTP
      greetingTimeout: 10_000, // 10s límite para saludo SMTP
      socketTimeout: 15_000, // 15s límite para operaciones de socket
    });

    return this.transporter;
  }

  async enviarResetPassword(email: string, resetUrl: string): Promise<void> {
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Restablecer tu contraseña — Smart Travel Planner',
        text:
          `Recibimos un pedido para restablecer tu contraseña.\n\n` +
          `Abrí este enlace para elegir una nueva (vence en 1 hora):\n${resetUrl}\n\n` +
          `Si no fuiste vos, ignorá este mensaje: tu contraseña no cambió.`,
        html:
          `<p>Recibimos un pedido para restablecer tu contraseña.</p>` +
          `<p><a href="${resetUrl}">Elegí una nueva contraseña</a> (el enlace vence en 1 hora).</p>` +
          `<p>Si no fuiste vos, ignorá este mensaje: tu contraseña no cambió.</p>`,
      });
      this.logger.log(`Email de reseteo enviado a ${email}`);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      // El detalle de SMTP queda en el log y no viaja al cliente: los errores
      // de nodemailer traen host y motivo de rechazo del servidor.
      this.logger.error(`Falló el envío de email a ${email}: ${mensaje}`);
      throw new InternalServerErrorException(
        'No se pudo enviar el email de restablecimiento',
      );
    }
  }

  /**
   * Se manda cuando alguien pide recuperar la contraseña de una dirección que
   * **no** tiene cuenta.
   *
   * Parece raro escribirle a quien no es usuario, pero es lo que resuelve el
   * problema sin abrir otro: el dueño de la casilla siempre se entera de qué
   * pasó, y quien está probando direcciones ajenas no aprende nada, porque la
   * API responde lo mismo exista o no la cuenta. Es lo que hacen GitHub y Slack.
   */
  async enviarCuentaInexistente(email: string): Promise<void> {
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();
    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const registroUrl = `${baseUrl}/register`;

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Pedido de restablecimiento — Smart Travel Planner',
        text:
          `Alguien pidió restablecer la contraseña de esta dirección, pero no hay ninguna cuenta asociada.\n\n` +
          `Si fuiste vos, puede que te hayas registrado con otro email. También podés crear una cuenta acá:\n${registroUrl}\n\n` +
          `Si no fuiste vos, ignorá este mensaje: no hay nada que hacer.`,
        html:
          `<p>Alguien pidió restablecer la contraseña de esta dirección, pero no hay ninguna cuenta asociada.</p>` +
          `<p>Si fuiste vos, puede que te hayas registrado con otro email. También podés <a href="${registroUrl}">crear una cuenta</a>.</p>` +
          `<p>Si no fuiste vos, ignorá este mensaje: no hay nada que hacer.</p>`,
      });
      this.logger.log(`Email de cuenta inexistente enviado a ${email}`);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falló el envío de email a ${email}: ${mensaje}`);
      throw new InternalServerErrorException('No se pudo enviar el email');
    }
  }

  /** Código de 6 dígitos para confirmar que la casilla es de quien se registró. */
  async enviarCodigoVerificacion(
    email: string,
    codigo: string,
    horasValidez: number,
  ): Promise<void> {
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '';
    const transporter = this.getTransporter();

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: `${codigo} es tu código — Smart Travel Planner`,
        text:
          `Tu código de verificación es: ${codigo}\n\n` +
          `Ingresalo en la app para confirmar tu email. Vence en ${horasValidez} horas.\n\n` +
          `Si no creaste esta cuenta, ignorá este mensaje.`,
        html:
          `<p>Tu código de verificación es:</p>` +
          `<p style="font-size:28px;letter-spacing:6px;font-weight:bold">${codigo}</p>` +
          `<p>Ingresalo en la app para confirmar tu email. Vence en ${horasValidez} horas.</p>` +
          `<p>Si no creaste esta cuenta, ignorá este mensaje.</p>`,
      });
      this.logger.log(`Código de verificación enviado a ${email}`);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falló el envío de email a ${email}: ${mensaje}`);
      throw new InternalServerErrorException(
        'No se pudo enviar el código de verificación',
      );
    }
  }
}
