import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface Mensaje {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  /**
   * Con `RESEND_API_KEY` el envío sale por la API HTTP de Resend; sin ella, por
   * SMTP con nodemailer.
   *
   * No es una preferencia estética: **Render bloquea el tráfico saliente a los
   * puertos SMTP 25, 465 y 587 en los web services del plan free** (desde el
   * 2025-09-16). Desplegado, cualquier envío por SMTP muere con `ENETUNREACH` o
   * un timeout, aunque las credenciales estén bien. Una API HTTP no usa esos
   * puertos, así que pasa.
   *
   * El SMTP se mantiene para desarrollo local, donde no hay bloqueo y evita
   * tener que configurar nada.
   */
  private get usaResend(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
  }

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

  /**
   * El remitente con nombre visible, no la dirección pelada.
   *
   * Importa para que el mensaje llegue: los filtros —Outlook sobre todo, que es
   * más estricto que Gmail y además descarta en silencio, sin rebote—
   * desconfían del correo transaccional que sale de una casilla personal.
   *
   * Con Resend, además, `MAIL_FROM` **tiene que ser una dirección de un dominio
   * verificado** en la cuenta de Resend; una de Gmail la rechaza con 403.
   */
  private remitente(): string {
    const direccion = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '';
    return direccion ? `Smart Travel Planner <${direccion}>` : '';
  }

  private async porResend(m: Mensaje): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.remitente(), ...m }),
    });

    if (!res.ok) {
      // El cuerpo trae el motivo real (dominio sin verificar, key inválida,
      // destinatario no permitido en el modo de prueba). Sin esto queda un
      // "falló el envío" imposible de diagnosticar.
      const detalle = await res.text().catch(() => '');
      throw new Error(
        `Resend respondió ${res.status}: ${detalle.slice(0, 300)}`,
      );
    }
  }

  private async porSmtp(m: Mensaje): Promise<void> {
    await this.getTransporter().sendMail({ from: this.remitente(), ...m });
  }

  /**
   * Único punto de envío. `queEs` es para el log; `siFalla` es lo que ve el
   * cliente, que nunca incluye el detalle del proveedor: los errores traen host
   * y motivo de rechazo.
   */
  private async enviar(
    m: Mensaje,
    queEs: string,
    siFalla: string,
  ): Promise<void> {
    try {
      if (this.usaResend) await this.porResend(m);
      else await this.porSmtp(m);
      this.logger.log(`${queEs} enviado a ${m.to}`);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falló el envío de ${queEs} a ${m.to}: ${mensaje}`);
      throw new InternalServerErrorException(siFalla);
    }
  }

  async enviarResetPassword(email: string, resetUrl: string): Promise<void> {
    await this.enviar(
      {
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
      },
      'email de reseteo',
      'No se pudo enviar el email de restablecimiento',
    );
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
    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const registroUrl = `${baseUrl}/register`;

    await this.enviar(
      {
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
      },
      'email de cuenta inexistente',
      'No se pudo enviar el email',
    );
  }

  /** Código de 6 dígitos para confirmar que la casilla es de quien se registró. */
  async enviarCodigoVerificacion(
    email: string,
    codigo: string,
    horasValidez: number,
  ): Promise<void> {
    await this.enviar(
      {
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
      },
      'código de verificación',
      'No se pudo enviar el código de verificación',
    );
  }
}
