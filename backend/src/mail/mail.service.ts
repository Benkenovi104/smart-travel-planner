import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
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
    const port = Number(process.env.SMTP_PORT ?? 465);
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
      this.logger.error(`Falló el envío de email a ${email}: ${mensaje}`);
      throw new InternalServerErrorException(
        'No se pudo enviar el email de restablecimiento',
      );
    }
  }
}
