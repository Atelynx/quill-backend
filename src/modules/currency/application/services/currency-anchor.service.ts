import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CacheService } from '../../../system/application/services/cache/cache.service';
import type { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';
import { CurrencyDataProviderResolver } from './currency-data-provider.resolver';

const BASE_PRICE_KEY = (symbol: string) => `forex:${symbol}:base_price`;
const LIVE_PRICE_KEY = (symbol: string) => `forex:${symbol}:live_price`;

@Injectable()
export class CurrencyAnchorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CurrencyAnchorService.name);
  private readonly jobName = 'currency-anchor';
  private currentCronExpression: string | null = null;

  constructor(
    private readonly providerResolver: CurrencyDataProviderResolver,
    private readonly cacheService: CacheService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const provider = await this.providerResolver.getProvider();
    const symbols = provider.getSymbols();

    if (!symbols.length) {
      this.logger.warn(
        `Provider "${provider.getName()}" has no symbols. Skipping anchor init.`,
      );
      return;
    }

    this.logger.log(
      `Seeding initial anchor prices for [${symbols.join(', ')}]`,
    );
    await this.fetchAnchorsForSymbols(provider, symbols);

    this.reconcileSchedule(provider);
  }

  onModuleDestroy(): void {
    this.removeCronIfExists();
  }

  private async handleAnchorCron(): Promise<void> {
    const provider = await this.providerResolver.getProvider();
    this.reconcileSchedule(provider);
    const symbols = provider.getSymbols();
    if (!symbols.length) return;
    this.logger.log('Running scheduled anchor fetch...');
    await this.fetchAnchorsForSymbols(provider, symbols);
  }

  private reconcileSchedule(provider: CurrencyDataProvider): void {
    const schedule = provider.getRefreshSchedule?.();
    const newExpression = schedule?.cronExpression ?? null;

    if (this.currentCronExpression === newExpression) return;

    this.removeCronIfExists();
    this.currentCronExpression = null;

    if (newExpression !== null) {
      const job = new CronJob(
        newExpression,
        () => void this.handleAnchorCron(),
      );
      this.schedulerRegistry.addCronJob(this.jobName, job);
      job.start();
      this.logger.log(
        `Anchor cron scheduled with provider "${provider.getName()}" (${newExpression}).`,
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

  private async fetchAnchorsForSymbols(
    provider: CurrencyDataProvider,
    symbols: string[],
  ): Promise<void> {
    for (const symbol of symbols) {
      try {
        const quote = await provider.getQuote(symbol);
        const anchorPrice = quote.close ?? quote.price;

        await this.cacheService.set(BASE_PRICE_KEY(symbol), anchorPrice);

        const existingLive = await this.cacheService.get<number>(
          LIVE_PRICE_KEY(symbol),
        );
        if (existingLive == null) {
          await this.cacheService.set(LIVE_PRICE_KEY(symbol), anchorPrice);
        }

        this.logger.debug(`Anchor updated for ${symbol}: ${anchorPrice}`);
      } catch (error) {
        this.logger.error(
          `Failed to fetch anchor for ${symbol}: ${describeError(error)}`,
        );
      }
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
