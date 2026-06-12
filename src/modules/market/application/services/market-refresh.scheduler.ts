import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { MarketDataProvider } from '../../infrastructure/providers/market-data-provider.interface';
import { MarketDataProviderResolver } from './market-data-provider.resolver';
import { MarketRefreshService } from './market-refresh.service';

/**
 * Generic market refresh scheduler that registers a cron job
 * only when the active provider declares a refresh schedule.
 *
 * Self-reconciles on every tick: if the provider was swapped at runtime,
 * the cron schedule is updated to match the new provider.
 */
@Injectable()
export class MarketRefreshScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketRefreshScheduler.name);
  private readonly jobName = 'market-refresh';
  private currentCronExpression: string | null = null;

  constructor(
    private readonly providerResolver: MarketDataProviderResolver,
    private readonly marketRefreshService: MarketRefreshService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const provider = await this.providerResolver.getProvider();
    this.reconcileSchedule(provider);
  }

  onModuleDestroy(): void {
    this.removeCronIfExists();
  }

  private async runRefresh(): Promise<void> {
    this.logger.log('Running scheduled market refresh...');
    try {
      const provider = await this.providerResolver.getProvider();
      this.reconcileSchedule(provider);
      await this.marketRefreshService.refreshMarket();
      this.logger.log('Scheduled market refresh completed successfully.');
    } catch (error) {
      this.logger.error(
        `Scheduled market refresh failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private reconcileSchedule(provider: MarketDataProvider): void {
    const schedule = provider.getRefreshSchedule?.();
    const newExpression = schedule?.cronExpression ?? null;

    if (this.currentCronExpression === newExpression) return;

    this.removeCronIfExists();
    this.currentCronExpression = null;

    if (newExpression !== null) {
      const job = new CronJob(newExpression, () => void this.runRefresh());
      this.schedulerRegistry.addCronJob(this.jobName, job);
      job.start();
      this.logger.log(
        `Market refresh scheduled with provider "${provider.getName()}" (${newExpression}).`,
      );
    } else {
      this.logger.log(
        `Provider "${provider.getName()}" has no refresh schedule. Cron removed.`,
      );
    }

    this.currentCronExpression = newExpression;
  }

  private removeCronIfExists(): void {
    if (this.schedulerRegistry.doesExist('cron', this.jobName)) {
      this.schedulerRegistry.deleteCronJob(this.jobName);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
