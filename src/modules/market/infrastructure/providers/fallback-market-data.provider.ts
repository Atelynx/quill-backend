import { Injectable, Logger } from '@nestjs/common';
import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';
import type {
  MarketDataProvider,
  ProviderRefreshSchedule,
  StockSeed,
} from './market-data-provider.interface';

@Injectable()
export class FallbackMarketDataProvider implements MarketDataProvider {
  private readonly logger = new Logger(FallbackMarketDataProvider.name);

  constructor(
    private readonly primary: MarketDataProvider,
    private readonly fallback: MarketDataProvider,
  ) {}

  async getQuote(symbol: string): Promise<MarketQuote> {
    try {
      return await this.primary.getQuote(symbol);
    } catch (primaryError) {
      this.logger.warn(
        `${this.primary.getName()} failed for ${symbol}, falling back to ${this.fallback.getName()}: ${this.describeError(primaryError)}`,
      );
      return this.fallback.getQuote(symbol);
    }
  }

  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const results: MarketQuote[] = [];

    for (const symbol of symbols) {
      try {
        const quote = await this.primary.getQuote(symbol);
        results.push(quote);
      } catch (primaryError) {
        this.logger.warn(
          `${this.primary.getName()} failed for ${symbol}, falling back to ${this.fallback.getName()}: ${this.describeError(primaryError)}`,
        );
        try {
          const quote = await this.fallback.getQuote(symbol);
          results.push(quote);
        } catch (fallbackError) {
          this.logger.error(
            `Both providers failed for ${symbol}: ${this.describeError(fallbackError)}`,
          );
        }
      }
    }

    return results;
  }

  getName(): string {
    return `${this.primary.getName()}_with_fallback_to_${this.fallback.getName()}`;
  }

  getSeedData(): StockSeed[] {
    if (this.primary.getSeedData) {
      return this.primary.getSeedData();
    }
    return [];
  }

  getRefreshSchedule(): ProviderRefreshSchedule | undefined {
    return this.primary.getRefreshSchedule?.();
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
