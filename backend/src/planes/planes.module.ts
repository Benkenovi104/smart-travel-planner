import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PagosModule } from '../pagos/pagos.module.js';
import { PlanesController } from './planes.controller.js';
import { PlanesService } from './planes.service.js';

@Module({
  // Pagos: el plan vigente reconcilia con Mercado Pago las suscripciones vencidas,
  // por si se perdió el aviso de una renovación.
  imports: [PrismaModule, PagosModule],
  controllers: [PlanesController],
  providers: [PlanesService],
  // Lo usan viajes, itinerarios, vuelos y alojamiento para aplicar los límites.
  exports: [PlanesService],
})
export class PlanesModule {}
