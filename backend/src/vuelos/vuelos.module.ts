import { Module } from '@nestjs/common';
import { VuelosService } from './vuelos.service.js';
import { VuelosController } from './vuelos.controller.js';
import { SkyScrapperService } from './sky-scrapper.service.js';
import { PresupuestosModule } from '../presupuestos/presupuestos.module.js';
import { PlanesModule } from '../planes/planes.module.js';

@Module({
  imports: [PresupuestosModule, PlanesModule],
  providers: [VuelosService, SkyScrapperService],
  controllers: [VuelosController],
  exports: [VuelosService],
})
export class VuelosModule {}
