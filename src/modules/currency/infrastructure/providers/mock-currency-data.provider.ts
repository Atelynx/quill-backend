import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MarketQuote } from '../../../market/domain/interfaces/market-quote.interface';
import {
  CurrencyDataProvider,
  ProviderRefreshSchedule,
} from '../../domain/interfaces/currency-data-provider.interface';

@Injectable()
export class MockCurrencyDataProvider implements CurrencyDataProvider {
  private readonly rates = new Map<
    string,
    { price: number; previousPrice: number }
  >();
  private readonly symbols: string[];

  constructor(private readonly configService: ConfigService) {
    this.symbols = this.readSymbols();
    for (const symbol of this.symbols) {
      this.rates.set(symbol, { price: 900, previousPrice: 900 });
    }
  }

  getName(): string {
    return 'mock';
  }

  getSymbols(): string[] {
    return this.symbols;
  }

  getRefreshSchedule(): ProviderRefreshSchedule | undefined {
    return undefined;
  }

  getQuote(symbol: string): Promise<MarketQuote> {
    const upperSymbol = symbol.toUpperCase();

    if (!this.rates.has(upperSymbol)) {
      this.rates.set(upperSymbol, { price: 900, previousPrice: 900 });
    }

    const rate = this.rates.get(upperSymbol)!;
    const noise = (Math.random() - 0.5) * 2;
    const nextPrice = Number((rate.price + noise).toFixed(2));

    rate.previousPrice = rate.price;
    rate.price = nextPrice;

    const dayChangePercentage =
      rate.previousPrice > 0
        ? Number(
            (
              ((nextPrice - rate.previousPrice) / rate.previousPrice) *
              100
            ).toFixed(2),
          )
        : 0;

    return Promise.resolve({
      symbol: upperSymbol,
      price: nextPrice,
      close: nextPrice,
      currency: upperSymbol.includes('USD') ? 'USD' : upperSymbol.slice(-3),
      timestamp: new Date(),
      exchange: 'FOREX',
      previousClose: rate.previousPrice,
      dayChangePercentage,
    });
  }

  private readSymbols(): string[] {
    const raw = this.configService.get<string>(
      'MOCK_CURRENCY_SYMBOLS',
      'USDCLP',
    );
    return raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }
}
