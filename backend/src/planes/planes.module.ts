import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PlanesController } from './planes.controller.js';
import { PlanesService } from './planes.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PlanesController],
  providers: [PlanesService],
  // Lo usan viajes, itinerarios, vuelos y alojamiento para aplicar los límites.
  exports: [PlanesService],
})
export class PlanesModule {}
