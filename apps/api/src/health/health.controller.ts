import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Liveness + readiness in one payload. Deliberately uncached: a cached health
   * check reports the state of the last cache fill, not of the service.
   */
  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  async check() {
    return this.health.check();
  }
}
