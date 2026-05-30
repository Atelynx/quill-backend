import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import type { IMarketSimulationStrategy } from '../../../common/strategies/market-simulation-strategy.interface';
import { CacheService } from '../../../system/application/services/cache.service';
import { CURRENCY_UPDATE_EVENT } from '../../domain/constants/events';

const BASE_PRICE_KEY = (symbol: string) => `forex:${symbol}:base_price`;
const LIVE_PRICE_KEY = (symbol: string) => `forex:${symbol}:live_price`;

@Injectable()
export class CurrencyTickService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CurrencyTickService.name);
  private readonly symbols: string[];
  private readonly jobName = 'currency-tick';
  private isTicking = false;

  constructor(
    @Inject('CURRENCY_SIMULATION_STRATEGY')
    private readonly strategy: IMarketSimulationStrategy,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    const raw = this.configService.get<string>('CURRENCY_SYMBOLS', 'USDCLP');
    this.symbols = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  }

  onModuleInit(): void {
    const intervalSeconds = this.configService.get<number>('CURRENCY_RT_TICK_INTERVAL_SECONDS', 5);

    if (intervalSeconds <= 0 || !this.symbols.length) {
      this.logger.log('Currency tick simulation is disabled.');
      return;
    }

    const interval = setInterval(() => void this.processTick(), intervalSeconds * 1000);
    this.schedulerRegistry.addInterval(this.jobName, interval);
    this.logger.log(`Currency tick simulation started every ${intervalSeconds}s for [${this.symbols.join(', ')}]`);
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', this.jobName)) {
      this.schedulerRegistry.deleteInterval(this.jobName);
    }
  }

  private async processTick(): Promise<void> {
    if (this.isTicking) return;
    this.isTicking = true;

    try {
      const volatility = new Decimal(this.configService.get<number>('CURRENCY_ANCHOR_VOLATILITY', 0.005));
      const drift = new Decimal(this.configService.get<number>('CURRENCY_ANCHOR_DRIFT', 0));

      const updates: Array<{ symbol: string; close: number; dayChangePercentage: number }> = [];

      for (const symbol of this.symbols) {
        const basePrice = await this.cacheService.get<number>(BASE_PRICE_KEY(symbol));
        const livePrice = await this.cacheService.get<number>(LIVE_PRICE_KEY(symbol));

        if (basePrice == null || livePrice == null) {
          continue;
        }

        const nextPrice = this.strategy.calculateNextTick(
          new Decimal(basePrice),
          new Decimal(livePrice),
          volatility,
          drift,
        );

        await this.cacheService.set(LIVE_PRICE_KEY(symbol), nextPrice.toNumber());

        const dayChangePct = nextPrice
          .minus(basePrice)
          .dividedBy(basePrice)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber();

        updates.push({
          symbol,
          close: nextPrice.toNumber(),
          dayChangePercentage: dayChangePct,
        });
      }

      if (updates.length) {
        this.eventEmitter.emit(CURRENCY_UPDATE_EVENT, updates);
      }
    } finally {
      this.isTicking = false;
    }
  }
}
