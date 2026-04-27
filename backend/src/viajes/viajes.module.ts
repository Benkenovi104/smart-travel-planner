import { Module } from '@nestjs/common';
import { ViajesService } from './viajes.service.js';
import { ViajesController } from './viajes.controller.js';

@Module({
  providers: [ViajesService],
  controllers: [ViajesController],
})
export class ViajesModule {}
