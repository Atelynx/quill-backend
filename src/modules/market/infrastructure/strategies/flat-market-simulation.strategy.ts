import { Injectable } from '@nestjs/common';
import type Decimal from 'decimal.js';
import type { IMarketSimulationStrategy } from '../../domain/interfaces/market-simulation-strategy.interface';

@Injectable()
export class FlatMarketSimulationStrategy implements IMarketSimulationStrategy {
  calculateNextTick(
    _basePrice: Decimal,
    currentPrice: Decimal,
    _volatility: Decimal,
    _drift: Decimal,
  ): Decimal {
    return currentPrice;
  }
}
