import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET debe tener al menos 32 caracteres' })
  JWT_SECRET: string;

  @IsString()
  GEMINI_API_KEY: string;

  @IsString()
  GOOGLE_PLACES_API_KEY: string;

  @IsString()
  RAPIDAPI_KEY: string;

  // "true" para usar datos fixture en vuelos/alojamiento sin pegarle a RapidAPI
  // (evita quemar la cuota del free tier durante desarrollo/pruebas).
  @IsOptional()
  @IsIn(['true', 'false'])
  RAPIDAPI_MOCK?: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  // SMTP (Gmail) para el email de reseteo de contraseña. Opcionales: el server
  // arranca sin ellas, pero /auth/forgot-password fallará hasta configurarlas.
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsString()
  SMTP_PORT?: string;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  FRONTEND_URL?: string;

  // Mercado Pago. Opcionales, como SMTP: el server arranca sin ellas y los pagos
  // responden 503 hasta configurarlas.
  @IsOptional()
  @IsString()
  MP_ACCESS_TOKEN?: string;

  @IsOptional()
  @IsString()
  MP_WEBHOOK_SECRET?: string;

  // Adónde vuelve el usuario después de pagar: Mercado Pago rechaza lo que no sea https.
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  MP_BACK_URL?: string;

  // Solo en pruebas: la cuenta compradora de prueba, la única que puede pagar en el sandbox.
  @IsOptional()
  @IsEmail()
  MP_PAYER_EMAIL_PRUEBA?: string;

  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const detalle = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detalle}`);
  }

  return validatedConfig;
}
