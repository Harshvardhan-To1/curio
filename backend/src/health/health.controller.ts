import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { AppConfig } from '../config/configuration';

@Controller('api')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }

  @Get('version')
  version() {
    return {
      name: 'siterag-backend',
      version: process.env.npm_package_version ?? '0.1.0',
      embedMode: this.config.get('embedMode', { infer: true }),
      role: this.config.get('role', { infer: true }),
    };
  }
}
