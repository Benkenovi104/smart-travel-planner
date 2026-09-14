import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Plan } from '../../../generated/prisma/enums.js';
import type { PlanPago } from '../suscripciones.service.js';

const PLANES_PAGOS: PlanPago[] = [Plan.BASE, Plan.PREMIUM];

export class SuscribirDto {
  @ApiProperty({ enum: PLANES_PAGOS, example: Plan.BASE })
  @IsIn(PLANES_PAGOS, { message: 'El plan tiene que ser BASE o PREMIUM.' })
  plan: PlanPago;
}
