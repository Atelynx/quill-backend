import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { MarketService } from './market.service';

@Injectable()
export class EodhdDailyRefreshScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EodhdDailyRefreshScheduler.name);
  private readonly jobName = 'eodhd-daily-market-refresh';

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly marketService: MarketService,
  ) {}

  onModuleInit(): void {
    if (!this.shouldRegisterJob()) {
      return;
    }

    const cronExpression = this.configService.get<string>(
      'EODHD_DAILY_REFRESH_CRON',
      '0 30 18 * * 1-5',
    );
    const job = new CronJob(cronExpression, () => void this.runRefresh());

    this.schedulerRegistry.addCronJob(this.jobName, job);
    job.start();
    this.logger.log('Refresh diario EODHD programado.');
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('cron', this.jobName)) {
      this.schedulerRegistry.deleteCronJob(this.jobName);
    }
  }

  private shouldRegisterJob(): boolean {
    const provider = this.configService.get<string>('MARKET_PROVIDER', 'mock');
    const enabled = this.configService.get<boolean>(
      'EODHD_DAILY_REFRESH_ENABLED',
      true,
    );

    return provider.toLowerCase() === 'eodhd' && enabled;
  }

  private async runRefresh(): Promise<void> {
    try {
      await this.marketService.refreshMarket({ allowExternalFetch: true });
    } catch (error) {
      this.logger.error(
        `No se pudo ejecutar refresh diario EODHD: ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'error desconocido';
  }
}
