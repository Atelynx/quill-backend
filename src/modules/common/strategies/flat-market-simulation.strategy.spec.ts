import Decimal from 'decimal.js';
import { FlatMarketSimulationStrategy } from './flat-market-simulation.strategy';

describe('FlatMarketSimulationStrategy', () => {
  let strategy: FlatMarketSimulationStrategy;

  beforeEach(() => {
    strategy = new FlatMarketSimulationStrategy();
  });

  it('returns the current price unchanged', () => {
    const result = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(150),
      new Decimal(0.1),
      new Decimal(0.05),
    );

    expect(result.toNumber()).toBe(150);
  });

  it('returns a Decimal instance', () => {
    const result = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0),
      new Decimal(0),
    );

    expect(result).toBeInstanceOf(Decimal);
  });

  it('ignores all parameters', () => {
    const result = strategy.calculateNextTick(
      new Decimal(0),
      new Decimal(999.99),
      new Decimal(1),
      new Decimal(1),
    );

    expect(result.toNumber()).toBe(999.99);
  });
});
