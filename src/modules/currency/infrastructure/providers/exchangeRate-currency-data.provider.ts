import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MarketQuote } from '../../../market/domain/interfaces/market-quote.interface';
import { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';

@Injectable()
export class ExchangeRateCurrencyDataProvider implements CurrencyDataProvider {
  private readonly logger = new Logger(ExchangeRateCurrencyDataProvider.name);

  constructor(private readonly configService: ConfigService) {}

  getName(): string {
    return 'exchangeRate';
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const apiKey = this.configService.get<string>('EXCHANGE_RATE_API_KEY');

    if (!apiKey) {
      throw new Error(
        'EXCHANGE_RATE_API_KEY is not configured. Get a free key at https://www.exchangerate-api.com/',
      );
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    try {
      const quote = await this.fetchFromExternalApi(normalizedSymbol, apiKey);
      return quote;
    } catch (error) {
      throw new Error(
        `External provider ${this.getName()} failed for ${normalizedSymbol}: ${describeError(error)}`,
      );
    }
  }

  private async fetchFromExternalApi(symbol: string, apiKey: string): Promise<MarketQuote> {
    const baseCurrency = symbol.slice(0, 3);
    const quoteCurrency = symbol.slice(3);
    const baseUrl = this.configService.get<string>(
      'EXCHANGE_RATE_BASE_URL',
      'https://v6.exchangerate-api.com/v6',
    );

    const url = `${baseUrl}/${apiKey}/latest/${baseCurrency}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as {
      result: string;
      conversion_rates: Record<string, number>;
      time_last_update_unix: number;
    };

    if (data.result !== 'success') {
      throw new Error(`API returned result: "${data.result}"`);
    }

    const rate = data.conversion_rates[quoteCurrency];

    if (rate == null) {
      throw new Error(`Rate for ${quoteCurrency} not found in response`);
    }

    const price = Number(rate.toFixed(2));

    return {
      symbol,
      price,
      close: price,
      currency: quoteCurrency,
      timestamp: new Date(data.time_last_update_unix * 1000),
      exchange: 'exchangeRate',
    };
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
