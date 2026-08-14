import { Module } from '@nestjs/common';
import { ItinerariosService } from './itinerarios.service.js';
import { ItinerariosController } from './itinerarios.controller.js';
import { GeminiService } from './gemini.service.js';
import { PresupuestosModule } from '../presupuestos/presupuestos.module.js';
import { LugaresModule } from '../lugares/lugares.module.js';

@Module({
  imports: [PresupuestosModule, LugaresModule],
  providers: [ItinerariosService, GeminiService],
  controllers: [ItinerariosController],
  exports: [ItinerariosService, GeminiService],
})
export class ItinerariosModule {}
