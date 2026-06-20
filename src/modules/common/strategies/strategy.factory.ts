import { IMarketSimulationStrategy } from './market-simulation-strategy.interface';
import { FlatMarketSimulationStrategy } from './flat-market-simulation.strategy';
import { GBMMarketSimulationStrategy } from './gbm-market-simulation.strategy';
import { NoiseWaveSimulationStrategy } from './nw-simulation.strategy';
import { StrategyType } from './strategy.types';

export class StrategyFactory {
  static createStrategy(
    strategyName: StrategyType | undefined,
    gbm: GBMMarketSimulationStrategy,
    flat: FlatMarketSimulationStrategy,
    noiseWave: NoiseWaveSimulationStrategy,
  ): IMarketSimulationStrategy {
    const normalizedName = strategyName?.toLowerCase().trim();
    console.log(
      `Selected market simulation strategy: ${normalizedName ?? 'undefined'}`,
    );

    switch (normalizedName) {
      case 'flat':
        return flat;
      case 'gbm':
        return gbm;
      case 'nw':
        return noiseWave;
      default:
        throw new Error(
          `Unknown strategy: "${strategyName}". Valid options: "flat", "gbm", "nw"`,
        );
    }
  }
}
