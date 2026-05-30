import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { CacheService } from '../../../system/application/services/cache.service';
import type { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';

const BASE_PRICE_KEY = (symbol: string) => `forex:${symbol}:base_price`;
const LIVE_PRICE_KEY = (symbol: string) => `forex:${symbol}:live_price`;

@Injectable()
export class CurrencyAnchorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CurrencyAnchorService.name);
  private readonly symbols: string[];
  private readonly jobName = 'currency-anchor';

  constructor(
    @Inject('CURRENCY_DATA_PROVIDER')
    private readonly provider: CurrencyDataProvider,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    const raw = this.configService.get<string>('CURRENCY_SYMBOLS', 'USDCLP');
    this.symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  }

  async onModuleInit(): Promise<void> {
    if (!this.symbols.length) {
      this.logger.warn('No CURRENCY_SYMBOLS configured. Skipping anchor init.');
      return;
    }

    this.logger.log(`Seeding initial anchor prices for [${this.symbols.join(', ')}]`);
    await this.fetchAndStoreAnchors();

    const cronExpression = this.configService.get<string>(
      'CURRENCY_API_REQ_TICK',
      '0 0 * * * *',
    );

    const job = new CronJob(cronExpression, () => void this.handleAnchorCron());
    this.schedulerRegistry.addCronJob(this.jobName, job);
    job.start();
    this.logger.log(`Anchor cron scheduled (${cronExpression}).`);
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('cron', this.jobName)) {
      this.schedulerRegistry.deleteCronJob(this.jobName);
    }
  }

  private async handleAnchorCron(): Promise<void> {
    if (!this.symbols.length) return;
    this.logger.log('Running scheduled anchor fetch...');
    await this.fetchAndStoreAnchors();
  }

  private async fetchAndStoreAnchors(): Promise<void> {
    for (const symbol of this.symbols) {
      try {
        const quote = await this.provider.getQuote(symbol);
        const anchorPrice = quote.close ?? quote.price;

        await this.cacheService.set(BASE_PRICE_KEY(symbol), anchorPrice);

        const existingLive = await this.cacheService.get<number>(LIVE_PRICE_KEY(symbol));
        if (existingLive == null) {
          await this.cacheService.set(LIVE_PRICE_KEY(symbol), anchorPrice);
        }

        this.logger.debug(`Anchor updated for ${symbol}: ${anchorPrice}`);
      } catch (error) {
        this.logger.error(`Failed to fetch anchor for ${symbol}: ${describeError(error)}`);
      }
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
