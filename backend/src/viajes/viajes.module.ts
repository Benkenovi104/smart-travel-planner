import { Module } from '@nestjs/common';
import { ViajesService } from './viajes.service.js';
import { ViajesController } from './viajes.controller.js';
import { PresupuestosModule } from '../presupuestos/presupuestos.module.js';
import { ItinerariosModule } from '../itinerarios/itinerarios.module.js';

@Module({
  imports: [PresupuestosModule, ItinerariosModule],
  providers: [ViajesService],
  controllers: [ViajesController],
})
export class ViajesModule {}
