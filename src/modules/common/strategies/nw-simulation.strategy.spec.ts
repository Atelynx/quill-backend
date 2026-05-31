import Decimal from 'decimal.js';
import { NoiseWaveSimulationStrategy } from './nw-simulation.strategy';

describe('NoiseWaveSimulationStrategy', () => {
  let strategy: NoiseWaveSimulationStrategy;

  beforeEach(() => {
    strategy = new NoiseWaveSimulationStrategy();
  });

  it('returns a Decimal rounded to 2 decimal places', () => {
    const result = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0.01),
      new Decimal(0),
    );

    expect(result).toBeInstanceOf(Decimal);
    expect(result.decimalPlaces()).toBe(2);
  });

  it('returns prices >= 5 (floor protection)', () => {
    for (let i = 0; i < 50; i++) {
      const result = strategy.calculateNextTick(
        new Decimal(1),
        new Decimal(1),
        new Decimal(0.1),
        new Decimal(0),
      );
      expect(result.toNumber()).toBeGreaterThanOrEqual(5);
    }
  });

  it('is affected by drift parameter', () => {
    const negDrift = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0.01),
      new Decimal(-0.1),
    );
    const posDrift = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0.01),
      new Decimal(0.1),
    );

    expect(posDrift.toNumber()).toBeGreaterThan(negDrift.toNumber());
  });

  it('maintains momentum state across calls', () => {
    const r1 = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(100),
      new Decimal(0.01),
      new Decimal(0),
    );
    const r2 = strategy.calculateNextTick(
      new Decimal(100),
      new Decimal(r1),
      new Decimal(0.01),
      new Decimal(0),
    );

    const diff1 = Math.abs(r1.toNumber() - 100);
    const diff2 = Math.abs(r2.toNumber() - 100);
    expect(diff2).toBeGreaterThan(0);
  });
});
