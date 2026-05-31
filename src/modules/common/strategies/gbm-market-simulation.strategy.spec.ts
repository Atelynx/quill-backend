import Decimal from 'decimal.js';
import { GBMMarketSimulationStrategy } from './gbm-market-simulation.strategy';

describe('GBMMarketSimulationStrategy', () => {
  let strategy: GBMMarketSimulationStrategy;

  beforeEach(() => {
    strategy = new GBMMarketSimulationStrategy();
  });

  it('returns a Decimal close to the current price with low volatility', () => {
    const result = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0.001),
      new Decimal(0),
    );

    expect(result).toBeInstanceOf(Decimal);
    expect(result.toNumber()).toBeGreaterThan(90);
    expect(result.toNumber()).toBeLessThan(110);
  });

  it('produces different results with different random values', () => {
    const result1 = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0.01),
      new Decimal(0),
    );
    const result2 = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0.01),
      new Decimal(0),
    );

    expect(result1.toNumber()).not.toBe(result2.toNumber());
  });

  it('is affected by volatility', () => {
    const lowVol = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0.001),
      new Decimal(0),
    );
    const highVol = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0.1),
      new Decimal(0),
    );

    const lowDiff = Math.abs(lowVol.toNumber() - 100);
    const highDiff = Math.abs(highVol.toNumber() - 100);
    expect(highDiff).toBeGreaterThan(lowDiff);
  });

  it('handles zero volatility', () => {
    const result = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0),
      new Decimal(0),
    );

    expect(result.toNumber()).toBe(100);
  });

  it('never returns negative prices', () => {
    for (let i = 0; i < 100; i++) {
      const result = strategy.calculateNextTick(
        new Decimal(10),
        new Decimal(10),
        new Decimal(0.5),
        new Decimal(0),
      );
      expect(result.toNumber()).toBeGreaterThan(0);
    }
  });

  it('handles very small prices', () => {
    const result = strategy.calculateNextTick(
      new Decimal(0.01),
      new Decimal(0.01),
      new Decimal(0.01),
      new Decimal(0),
    );

    expect(result.toNumber()).toBeGreaterThan(0);
  });
});
