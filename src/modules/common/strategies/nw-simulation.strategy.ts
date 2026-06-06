import { Injectable } from '@nestjs/common';
import { IMarketSimulationStrategy } from './market-simulation-strategy.interface';
import Decimal from 'decimal.js';

@Injectable()
export class NoiseWaveSimulationStrategy implements IMarketSimulationStrategy {
  private previousMomentum = new Decimal(0);

  calculateNextTick(
    basePrice: Decimal,
    currentPrice: Decimal,
    volatility: Decimal,
    drift: Decimal,
  ): Decimal {
    const previousMomentum = this.previousMomentum.toNumber();
    const noise = (Math.random() - 0.5) * volatility.toNumber() * 0.6;
    const wave =
      Math.sin(Date.now() / 45000 + currentPrice.toNumber() / 120) * 0.0016;
    const driftValue = drift.toNumber() * 0.1;

    const nextMomentum = Math.max(
      Math.min(previousMomentum * 0.62 + noise + wave + driftValue, 0.009),
      -0.009,
    );

    this.previousMomentum = new Decimal(nextMomentum);

    const anchoredPrice = currentPrice.plus(basePrice).div(2);
    const nextPrice = anchoredPrice.mul(new Decimal(1).plus(nextMomentum));

    return Decimal.max(nextPrice, new Decimal(5)).toDecimalPlaces(2);
  }
}
