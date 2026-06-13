import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { IMarketSimulationStrategy } from './market-simulation-strategy.interface';

@Injectable()
export class GBMMarketSimulationStrategy implements IMarketSimulationStrategy {
  calculateNextTick(
    _basePrice: Decimal.Instance,
    currentPrice: Decimal.Instance,
    volatility: Decimal.Instance,
    drift: Decimal.Instance,
  ): Decimal {
    const dt = new Decimal(1);
    const epsilon = this.boxMuller();
    const expArg = drift
      .minus(volatility.pow(2).dividedBy(2))
      .times(dt)
      .plus(volatility.times(epsilon).times(Decimal.sqrt(dt)));
    const result = currentPrice.times(Decimal.exp(expArg));
    return result.toDecimalPlaces(2);
  }

  private boxMuller(): Decimal {
    let u1: number;
    do {
      u1 = Math.random();
    } while (u1 <= 0);
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return new Decimal(z);
  }
}
