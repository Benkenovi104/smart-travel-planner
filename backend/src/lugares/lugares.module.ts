import { Module } from '@nestjs/common';
import { LugaresService } from './lugares.service.js';
import { LugaresController } from './lugares.controller.js';
import { GooglePlacesService } from './google-places.service.js';
import { GeocodingService } from './geocoding.service.js';

@Module({
  providers: [LugaresService, GooglePlacesService, GeocodingService],
  controllers: [LugaresController],
  exports: [LugaresService, GooglePlacesService, GeocodingService],
})
export class LugaresModule {}
