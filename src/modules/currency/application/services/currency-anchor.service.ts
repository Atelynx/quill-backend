import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../../../system/application/services/cache.service';
import type { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';

const BASE_PRICE_KEY = (symbol: string) => `forex:${symbol}:base_price`;
const LIVE_PRICE_KEY = (symbol: string) => `forex:${symbol}:live_price`;

@Injectable()
export class CurrencyAnchorService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyAnchorService.name);
  private readonly symbols: string[];

  constructor(
    @Inject('CURRENCY_DATA_PROVIDER')
    private readonly provider: CurrencyDataProvider,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
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
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleAnchorCron(): Promise<void> {
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
