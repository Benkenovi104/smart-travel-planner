import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MercadoPagoService } from './mercado-pago.service.js';
import { PagosController } from './pagos.controller.js';
import { SuscripcionesController } from './suscripciones.controller.js';
import { SuscripcionesService } from './suscripciones.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SuscripcionesController, PagosController],
  providers: [MercadoPagoService, SuscripcionesService],
  // Lo usa usuarios: borrar la cuenta cancela antes la suscripción.
  exports: [SuscripcionesService],
})
export class PagosModule {}
