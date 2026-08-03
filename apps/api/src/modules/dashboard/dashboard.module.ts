import { Module } from '@nestjs/common';
import { DashboardController } from './presentation/dashboard.controller';
import { DashboardService } from './application/dashboard.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
