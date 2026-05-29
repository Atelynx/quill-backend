import { ConfigService } from "@nestjs/config";
import { IMarketSimulationStrategy } from "../../domain/interfaces/market-simulation-strategy.interface";
import { FlatMarketSimulationStrategy } from "./flat-market-simulation.strategy";
import { GBMMarketSimulationStrategy } from "./gbm-market-simulation.strategy";
import { NoiseWaveSimulationStrategy } from "./nw-simulation.strategy";

/**
 * Factory for creating strategy instances based on configuration.
 * Supports dynamic strategy selection at runtime.
 */
export class StrategyFactory {
    /**
     * Create a strategy instance based on strategy name.
     *
     * @param strategyName - 'mock' | 'eodhd' | 'none' | undefined | ''
     * @param flatStrategy - Injected MockMarketDatastrategy instance
     * @param bgmStrategy - Injected EodhdMarketDatastrategy instance
     * @param nwStrategy - Injected NoneMarketDatastrategy instance
     * @returns MarketDatastrategy instance ready to use
     * @throws Error if strategy name is invalid
     */
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
                    `Unknown market strategy: "${strategyName}". Valid options: "flat", "gbm", "nw"`,
                );
        }
    }
}
