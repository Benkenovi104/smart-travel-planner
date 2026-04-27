import { Module } from '@nestjs/common';
import { ItinerariosService } from './itinerarios.service.js';
import { ItinerariosController } from './itinerarios.controller.js';
import { GeminiService } from './gemini.service.js';

@Module({
  providers: [ItinerariosService, GeminiService],
  controllers: [ItinerariosController],
})
export class ItinerariosModule {}
