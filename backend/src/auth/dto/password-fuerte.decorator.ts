import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const PASSWORD_MIN = 8;
/** bcrypt ignora todo lo que pase de 72 bytes: cortar antes evita la sorpresa. */
export const PASSWORD_MAX = 72;

const REGLAS: { cumple: (v: string) => boolean; falta: string }[] = [
  {
    cumple: (v) => v.length >= PASSWORD_MIN,
    falta: `al menos ${PASSWORD_MIN} caracteres`,
  },
  { cumple: (v) => /[a-z]/.test(v), falta: 'una minúscula' },
  { cumple: (v) => /[A-Z]/.test(v), falta: 'una mayúscula' },
  { cumple: (v) => /[0-9]/.test(v), falta: 'un número' },
  {
    cumple: (v) => /[^A-Za-z0-9]/.test(v),
    falta: 'un carácter especial (por ejemplo !, ? o #)',
  },
];

function loQueFalta(valor: unknown): string[] {
  if (typeof valor !== 'string') return [];
  return REGLAS.filter((r) => !r.cumple(valor)).map((r) => r.falta);
}

/**
 * Un único validador en vez de un `@Matches` por regla: class-validator indexa
 * los errores por nombre de validador, así que cuatro `@Matches` sobre el mismo
 * campo se pisan entre sí y devuelven **un solo** mensaje, arbitrario. El
 * usuario terminaría corrigiendo de a una por rebote.
 */
@ValidatorConstraint({ name: 'esPasswordFuerte', async: false })
class PasswordFuerteConstraint implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    return typeof valor === 'string' && loQueFalta(valor).length === 0;
  }

  defaultMessage(args: ValidationArguments): string {
    return `A la contraseña le falta: ${loQueFalta(args.value).join(', ')}`;
  }
}

/**
 * Reglas de composición para las contraseñas nuevas: largo, minúscula,
 * mayúscula, número y un carácter que no sea alfanumérico.
 *
 * Va como decorador compuesto porque las tres rutas que aceptan una contraseña
 * nueva (registro, reseteo y cambio desde el perfil) tienen que validar **lo
 * mismo**: si una queda más floja, se entra por ahí.
 *
 * Sólo corre en las altas y los cambios. Las contraseñas que ya están guardadas
 * siguen sirviendo para entrar aunque no cumplan, y `password_actual` no se
 * valida con estas reglas — si no, las cuentas viejas no podrían ni cambiarla.
 *
 * El espejo de esto en el frontend es `frontend/lib/password.ts`, que además
 * dibuja la lista de requisitos mientras se tipea. Si cambia una regla, hay que
 * tocar los dos lados.
 */
export function EsPasswordFuerte() {
  return applyDecorators(
    IsString(),
    MaxLength(PASSWORD_MAX, {
      message: `La contraseña no puede superar los ${PASSWORD_MAX} caracteres`,
    }),
    Validate(PasswordFuerteConstraint),
  );
}
