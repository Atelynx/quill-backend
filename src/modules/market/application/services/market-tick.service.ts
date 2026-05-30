import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import Decimal from 'decimal.js';
import { Model } from 'mongoose';
import { PRICE_UPDATE_EVENT } from '../../domain/constants/events';
import type { IMarketSimulationStrategy } from '../../../common/strategies/market-simulation-strategy.interface';
import { Stock, StockDocument } from '../../infrastructure/schemas/stock.schema';
import { CacheService } from '../../../system/application/services/cache.service';

const BASE_PRICE_CACHE_PREFIX = 'stock:';
const BASE_PRICE_CACHE_SUFFIX = ':base_price';
const LIVE_PRICE_CACHE_SUFFIX = ':live_price';

@Injectable()
export class MarketTickService {
  private readonly logger = new Logger(MarketTickService.name);
  private isTicking = false;

  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    @Inject('MARKET_SIMULATION_STRATEGY')
    private readonly strategy: IMarketSimulationStrategy,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processTick(): Promise<void> {
    if (this.isTicking) {
      return;
    }

    this.isTicking = true;
    try {
      const stocks = await this.stockModel.find().lean().exec();

      if (!stocks.length) {
        return;
      }

      const updates: Array<{
        symbol: string;
        close: number;
        dayChangePercentage: number;
      }> = [];

      for (const stock of stocks) {
        const basePrice = await this.cacheService.get<number>(
          `${BASE_PRICE_CACHE_PREFIX}${stock.symbol}${BASE_PRICE_CACHE_SUFFIX}`,
        );
        const livePrice = await this.cacheService.get<number>(
          `${BASE_PRICE_CACHE_PREFIX}${stock.symbol}${LIVE_PRICE_CACHE_SUFFIX}`,
        );

        if (basePrice == null || livePrice == null) {
          continue;
        }

        const volatility = new Decimal(stock.baseVolatility ?? 0.015);
        const drift = new Decimal(stock.baseDrift ?? 0);
        const nextPrice = this.strategy.calculateNextTick(
          new Decimal(basePrice),
          new Decimal(livePrice),
          volatility,
          drift,
        );

        await this.cacheService.set(
          `${BASE_PRICE_CACHE_PREFIX}${stock.symbol}${LIVE_PRICE_CACHE_SUFFIX}`,
          nextPrice.toNumber(),
        );

        const dayChangePct = nextPrice
          .minus(basePrice)
          .dividedBy(basePrice)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber();

        updates.push({
          symbol: stock.symbol,
          close: nextPrice.toNumber(),
          dayChangePercentage: dayChangePct,
        });
      }

      if (updates.length) {
        this.eventEmitter.emit(PRICE_UPDATE_EVENT, updates);
      }
    } finally {
      this.isTicking = false;
    }
  }
}
