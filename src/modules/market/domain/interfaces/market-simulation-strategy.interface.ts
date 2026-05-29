import type Decimal from 'decimal.js';

export interface IMarketSimulationStrategy {
  calculateNextTick(
    basePrice: Decimal,
    currentPrice: Decimal,
    volatility: Decimal,
    drift: Decimal,
  ): Decimal;
}
