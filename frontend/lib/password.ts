import { z } from 'zod';

export const PASSWORD_MIN = 8;
/** bcrypt ignora todo lo que pase de 72 bytes; el backend corta en el mismo número. */
export const PASSWORD_MAX = 72;

/**
 * Espejo de `backend/src/auth/dto/password-fuerte.decorator.ts`. El backend es
 * el que manda —acá se valida sólo para no hacer ida y vuelta por algo que ya
 * sabemos que va a fallar—, así que si cambia una regla hay que tocar los dos
 * lados o el usuario ve un error del server que el form no supo anticipar.
 */
export const REQUISITOS_PASSWORD = [
  {
    id: 'largo',
    label: `Al menos ${PASSWORD_MIN} caracteres`,
    cumple: (v: string) => v.length >= PASSWORD_MIN,
  },
  {
    id: 'minuscula',
    label: 'Una minúscula',
    cumple: (v: string) => /[a-z]/.test(v),
  },
  {
    id: 'mayuscula',
    label: 'Una mayúscula',
    cumple: (v: string) => /[A-Z]/.test(v),
  },
  {
    id: 'numero',
    label: 'Un número',
    cumple: (v: string) => /[0-9]/.test(v),
  },
  {
    id: 'especial',
    label: 'Un carácter especial (!, ?, #…)',
    cumple: (v: string) => /[^A-Za-z0-9]/.test(v),
  },
] as const;

/**
 * Un `superRefine` en vez de encadenar `.regex()`: zod corta en el primer error
 * de una cadena, y acá queremos que el form pueda tildar los requisitos que
 * faltan todos juntos mientras se tipea.
 */
export const passwordFuerte = z
  .string()
  .max(PASSWORD_MAX, `Máximo ${PASSWORD_MAX} caracteres`)
  .superRefine((valor, ctx) => {
    for (const requisito of REQUISITOS_PASSWORD) {
      if (!requisito.cumple(valor)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Falta: ${requisito.label.toLowerCase()}`,
        });
      }
    }
  });

/** Cuántos requisitos cumple hoy. Sirve para la barra de fuerza. */
export function requisitosCumplidos(valor: string): number {
  return REQUISITOS_PASSWORD.filter((r) => r.cumple(valor)).length;
}
