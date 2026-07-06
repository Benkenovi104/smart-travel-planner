import { Module } from '@nestjs/common';
import { LugaresService } from './lugares.service.js';
import { LugaresController } from './lugares.controller.js';
import { GooglePlacesService } from './google-places.service.js';

@Module({
  providers: [LugaresService, GooglePlacesService],
  controllers: [LugaresController],
  exports: [LugaresService],
})
export class LugaresModule {}
