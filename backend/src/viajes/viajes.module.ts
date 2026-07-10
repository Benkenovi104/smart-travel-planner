import { Module } from '@nestjs/common';
import { ViajesService } from './viajes.service.js';
import { ViajesController } from './viajes.controller.js';
import { PresupuestosModule } from '../presupuestos/presupuestos.module.js';

@Module({
  imports: [PresupuestosModule],
  providers: [ViajesService],
  controllers: [ViajesController],
})
export class ViajesModule {}
