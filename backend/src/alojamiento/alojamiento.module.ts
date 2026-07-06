import { Module } from '@nestjs/common';
import { AlojamientoService } from './alojamiento.service.js';
import { AlojamientoController } from './alojamiento.controller.js';
import { BookingService } from './booking.service.js';

@Module({
  providers: [AlojamientoService, BookingService],
  controllers: [AlojamientoController],
  exports: [AlojamientoService],
})
export class AlojamientoModule {}
