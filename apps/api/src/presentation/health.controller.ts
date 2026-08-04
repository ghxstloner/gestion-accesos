import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/presentation/decorators/public.decorator';
import { PrismaService } from '../common/infrastructure/prisma/prisma.service';

/**
 * Liveness/readiness endpoints. They bypass the global ThrottlerGuard so
 * container orchestrators (k8s probes, Docker healthchecks, uptime robots)
 * can poll them frequently without being incorrectly rate-limited.
 */
@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @SkipThrottle({ default: true })
  @ApiOperation({ summary: 'Liveness probe' })
  liveness(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @SkipThrottle({ default: true })
  @ApiOperation({ summary: 'Readiness probe — checks database connection' })
  async readiness(): Promise<{
    status: string;
    database: string;
    timestamp: string;
  }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'degraded',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
