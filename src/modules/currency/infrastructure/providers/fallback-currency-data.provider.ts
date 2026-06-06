import { Injectable, Logger } from '@nestjs/common';
import type { MarketQuote } from '../../../market/domain/interfaces/market-quote.interface';
import type {
  CurrencyDataProvider,
  ProviderRefreshSchedule,
} from '../../domain/interfaces/currency-data-provider.interface';

@Injectable()
export class FallbackCurrencyDataProvider implements CurrencyDataProvider {
  private readonly logger = new Logger(FallbackCurrencyDataProvider.name);

  constructor(
    private readonly primary: CurrencyDataProvider,
    private readonly fallback: CurrencyDataProvider,
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

  getName(): string {
    return `${this.primary.getName()}_with_fallback_to_${this.fallback.getName()}`;
  }

  getSymbols(): string[] {
    return this.primary.getSymbols();
  }

  getRefreshSchedule(): ProviderRefreshSchedule | undefined {
    return this.primary.getRefreshSchedule?.();
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
