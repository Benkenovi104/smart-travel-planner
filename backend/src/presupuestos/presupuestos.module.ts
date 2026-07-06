import { Module } from '@nestjs/common';
import { PresupuestosService } from './presupuestos.service.js';
import { PresupuestosController } from './presupuestos.controller.js';

@Module({
  providers: [PresupuestosService],
  controllers: [PresupuestosController],
  exports: [PresupuestosService],
})
export class PresupuestosModule {}
