import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Plan, TipoConsumo } from '../../generated/prisma/enums.js';

// Solo documentan en Swagger los cuerpos que arman LimitePlanException,
// TopeDiarioException y ViajesService.create: no se usan para validar nada.

export class LimitePlanRespuesta {
  @ApiProperty({ example: 403 })
  statusCode: number;

  @ApiProperty({ example: 'LIMITE_PLAN' })
  codigo: string;

  @ApiProperty({ example: 'Buscar vuelos no está incluido en el plan Gratis.' })
  message: string;

  @ApiProperty({ enum: TipoConsumo, example: TipoConsumo.BUSCAR_VUELOS })
  accion: TipoConsumo;

  @ApiProperty({ enum: Plan, example: Plan.GRATIS })
  planActual: Plan;

  @ApiProperty({
    enum: Plan,
    nullable: true,
    example: Plan.BASE,
    description:
      'El plan más barato que habilita la acción; null si ninguno la amplía.',
  })
  planSugerido: Plan | null;

  @ApiProperty({ example: 0 })
  limite: number;

  @ApiProperty({ example: 0 })
  usado: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Cuándo se renueva el límite. Solo en los límites por período (viajes); los límites por viaje no se renuevan.',
  })
  renuevaEl: Date | null;
}

export class TopeDiarioRespuesta {
  @ApiProperty({ example: 403 })
  statusCode: number;

  @ApiProperty({ example: 'TOPE_DIARIO' })
  codigo: string;

  @ApiProperty({
    example:
      'Llegaste al máximo de 20 búsquedas de vuelos y alojamiento en 24 horas. Volvé a intentar más tarde.',
  })
  message: string;

  @ApiProperty({ enum: TipoConsumo, example: TipoConsumo.BUSCAR_ALOJAMIENTO })
  accion: TipoConsumo;

  @ApiProperty({ example: 20 })
  limite: number;

  @ApiProperty({ example: 20 })
  usado: number;
}

export class BorradorExistenteRespuesta {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({ example: 'BORRADOR_EXISTENTE' })
  codigo: string;

  @ApiProperty({
    example:
      'Ya tenés un viaje a medio armar. Terminalo o borralo antes de crear otro.',
  })
  message: string;

  @ApiProperty({ example: 108 })
  idViaje: number;
}

/**
 * El 403 de una acción que cuenta para el plan. Con `topeDiario: false` solo
 * documenta `LIMITE_PLAN`: crear viajes y optimizar no tienen tope diario.
 */
export function ApiRechazosDelPlan({ topeDiario = true } = {}) {
  const modelos = topeDiario
    ? [LimitePlanRespuesta, TopeDiarioRespuesta]
    : [LimitePlanRespuesta];

  return applyDecorators(
    ApiExtraModels(...modelos),
    ApiResponse({
      status: 403,
      description: topeDiario
        ? 'LIMITE_PLAN: el plan no incluye la acción o se agotó su límite (trae el plan que la habilita). TOPE_DIARIO: se alcanzó el tope anti-abuso de 24 horas, igual para todos los planes.'
        : 'LIMITE_PLAN: el plan no incluye la acción o se agotó su límite (trae el plan que la habilita).',
      schema: { oneOf: modelos.map((m) => ({ $ref: getSchemaPath(m) })) },
    }),
  );
}
