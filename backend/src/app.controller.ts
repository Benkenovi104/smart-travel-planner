import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service.js';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Chequeo de salud del servicio y conexión a la base de datos',
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
