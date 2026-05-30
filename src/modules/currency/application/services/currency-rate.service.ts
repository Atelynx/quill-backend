import { Inject, Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CacheService } from '../../../system/application/services/cache.service';
import type { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';

const BASE_PRICE_KEY = (symbol: string) => `forex:${symbol}:base_price`;
const LIVE_PRICE_KEY = (symbol: string) => `forex:${symbol}:live_price`;

export interface CurrencyRateEntry {
  symbol: string;
  rate: number;
  basePrice: number;
  dayChangePercentage: number;
}

@Injectable()
export class CurrencyRateService {
  private readonly logger = new Logger(CurrencyRateService.name);

  constructor(
    @Inject('CURRENCY_DATA_PROVIDER')
    private readonly provider: CurrencyDataProvider,
    private readonly cacheService: CacheService,
  ) {}

  async getRates(): Promise<CurrencyRateEntry[]> {
    const symbols = this.provider.getSymbols();
    const rates: CurrencyRateEntry[] = [];

    for (const symbol of symbols) {
      const [basePrice, livePrice] = await Promise.all([
        this.cacheService.get<number>(BASE_PRICE_KEY(symbol)),
        this.cacheService.get<number>(LIVE_PRICE_KEY(symbol)),
      ]);

      if (basePrice == null || livePrice == null) {
        continue;
      }

      const dayChangePct = new Decimal(livePrice)
        .minus(basePrice)
        .dividedBy(basePrice)
        .times(100)
        .toDecimalPlaces(2)
        .toNumber();

      rates.push({
        symbol,
        rate: livePrice,
        basePrice,
        dayChangePercentage: dayChangePct,
      });
    }

    return rates;
  }

  async getRate(symbol: string): Promise<CurrencyRateEntry | null> {
    const upperSymbol = symbol.toUpperCase();
    const [basePrice, livePrice] = await Promise.all([
      this.cacheService.get<number>(BASE_PRICE_KEY(upperSymbol)),
      this.cacheService.get<number>(LIVE_PRICE_KEY(upperSymbol)),
    ]);

    if (basePrice == null || livePrice == null) {
      return null;
    }

    const dayChangePct = new Decimal(livePrice)
      .minus(basePrice)
      .dividedBy(basePrice)
      .times(100)
      .toDecimalPlaces(2)
      .toNumber();

    return {
      symbol: upperSymbol,
      rate: livePrice,
      basePrice,
      dayChangePercentage: dayChangePct,
    };
  }
}
