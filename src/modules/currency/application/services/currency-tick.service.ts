import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import { CacheService } from '../../../system/application/services/cache/cache.service';
import { CURRENCY_UPDATE_EVENT } from '../../domain/constants/events';
import { CurrencyDataProviderResolver } from './currency-data-provider.resolver';
import { CurrencyStrategyResolver } from './currency-strategy.resolver';

const BASE_PRICE_KEY = (symbol: string) => `forex:${symbol}:base_price`;
const LIVE_PRICE_KEY = (symbol: string) => `forex:${symbol}:live_price`;

@Injectable()
export class CurrencyTickService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CurrencyTickService.name);
  private readonly jobName = 'currency-tick';
  private isTicking = false;

  constructor(
    private readonly providerResolver: CurrencyDataProviderResolver,
    private readonly strategyResolver: CurrencyStrategyResolver,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const provider = await this.providerResolver.getProvider();
    const symbols = provider.getSymbols();
    const intervalSeconds = this.configService.get<number>(
      'CURRENCY_RT_TICK_INTERVAL_SECONDS',
      5,
    );

    if (intervalSeconds <= 0 || !symbols.length) {
      this.logger.log('Currency tick simulation is disabled.');
      return;
    }

    const interval = setInterval(
      () => void this.processTick(),
      intervalSeconds * 1000,
    );
    this.schedulerRegistry.addInterval(this.jobName, interval);
    this.logger.log(
      `Currency tick simulation started every ${intervalSeconds}s for [${symbols.join(', ')}]`,
    );
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
      const provider = await this.providerResolver.getProvider();
      const symbols = provider.getSymbols();
      const volatility = new Decimal(
        this.configService.get<number>('CURRENCY_ANCHOR_VOLATILITY', 0.005),
      );
      const drift = new Decimal(
        this.configService.get<number>('CURRENCY_ANCHOR_DRIFT', 0),
      );

      const updates: Array<{
        symbol: string;
        close: number;
        dayChangePercentage: number;
      }> = [];

      for (const symbol of symbols) {
        const basePrice = await this.cacheService.get<number>(
          BASE_PRICE_KEY(symbol),
        );
        const livePrice = await this.cacheService.get<number>(
          LIVE_PRICE_KEY(symbol),
        );

        if (basePrice == null || livePrice == null) {
          continue;
        }

        const strategy = await this.strategyResolver.getStrategy();
        const nextPrice = strategy.calculateNextTick(
          new Decimal(basePrice),
          new Decimal(livePrice),
          volatility,
          drift,
        );

        await this.cacheService.set(
          LIVE_PRICE_KEY(symbol),
          nextPrice.toNumber(),
        );

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
