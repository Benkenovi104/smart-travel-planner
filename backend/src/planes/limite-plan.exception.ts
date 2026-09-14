import { HttpException, HttpStatus } from '@nestjs/common';
import { Plan, TipoConsumo } from '../../generated/prisma/enums.js';

/**
 * 403 cuando una acción excede lo que incluye el plan. El `codigo` es lo que le
 * permite al frontend distinguirlo de cualquier otro 403 y ofrecer subir de plan.
 */
export class LimitePlanException extends HttpException {
  constructor(
    readonly detalle: {
      message: string;
      accion: TipoConsumo;
      planActual: Plan;
      /** El plan más barato que habilita la acción; `null` si ninguno la amplía. */
      planSugerido: Plan | null;
      limite: number;
      usado: number;
      /** Solo en los límites por período. Los límites por viaje no se renuevan. */
      renuevaEl: Date | null;
    },
  ) {
    super(
      { statusCode: HttpStatus.FORBIDDEN, codigo: 'LIMITE_PLAN', ...detalle },
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * 403 por el tope anti-abuso diario. Lleva otro `codigo` y **no** sugiere plan:
 * el tope es igual para todos, así que ofrecer subir sería engañoso.
 */
export class TopeDiarioException extends HttpException {
  constructor(
    readonly detalle: {
      message: string;
      accion: TipoConsumo;
      limite: number;
      usado: number;
    },
  ) {
    super(
      { statusCode: HttpStatus.FORBIDDEN, codigo: 'TOPE_DIARIO', ...detalle },
      HttpStatus.FORBIDDEN,
    );
  }
}
