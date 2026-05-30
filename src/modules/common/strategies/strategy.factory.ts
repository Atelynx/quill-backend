import { IMarketSimulationStrategy } from './market-simulation-strategy.interface';
import { FlatMarketSimulationStrategy } from './flat-market-simulation.strategy';
import { GBMMarketSimulationStrategy } from './gbm-market-simulation.strategy';
import { NoiseWaveSimulationStrategy } from './nw-simulation.strategy';

export class StrategyFactory {
    static createStrategy(
        strategyName: string | undefined,
        gbm: GBMMarketSimulationStrategy,
        flat: FlatMarketSimulationStrategy,
        noiseWave: NoiseWaveSimulationStrategy,
    ): IMarketSimulationStrategy {
        const normalizedName = strategyName?.toLowerCase().trim();

        switch (normalizedName) {
            case 'flat':
                return flat;
            case 'gbm':
                return gbm;
            case 'nw':
                return noiseWave
            default:
                throw new Error(
                    `Unknown strategy: "${strategyName}". Valid options: "flat", "gbm", "nw"`,
                );
        }
    }
}
