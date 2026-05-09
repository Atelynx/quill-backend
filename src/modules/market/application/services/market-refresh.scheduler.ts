import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { MarketDataProvider } from '../../infrastructure/providers/market-data-provider.interface';
import { MarketRefreshService } from './market-refresh.service';

/**
 * Generic market refresh scheduler that registers a cron job
 * only when the active provider declares a refresh schedule.
 *
 * Providers opt-in by implementing getRefreshSchedule() on the
 * MarketDataProvider interface. If undefined is returned, no
 * scheduled job is created.
 */
@Injectable()
export class MarketRefreshScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketRefreshScheduler.name);
  private readonly jobName = 'market-refresh';

  constructor(
    @Inject('MARKET_DATA_PROVIDER')
    private readonly provider: MarketDataProvider,
    private readonly marketRefreshService: MarketRefreshService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    // Only register a scheduled refresh if the provider declares one
    const schedule = this.provider.getRefreshSchedule?.();
    if (!schedule) {
      this.logger.log(
        `Provider "${this.provider.getName()}" does not declare a refresh schedule. Skipping scheduled job.`,
      );
      return;
    }

    const job = new CronJob(schedule.cronExpression, () =>
      void this.runRefresh(),
    );

    this.schedulerRegistry.addCronJob(this.jobName, job);
    job.start();
    this.logger.log(
      `Market refresh scheduled with provider "${this.provider.getName()}" (${schedule.cronExpression}).`,
    );
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('cron', this.jobName)) {
      this.schedulerRegistry.deleteCronJob(this.jobName);
    }
  }

  private async runRefresh(): Promise<void> {
    this.logger.log('Running scheduled market refresh...');
    try {
      await this.marketRefreshService.refreshMarket();
      this.logger.log('Scheduled market refresh completed successfully.');
    } catch (error) {
      this.logger.error(
        `Scheduled market refresh failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
