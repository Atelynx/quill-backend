import { Module } from '@nestjs/common';
import { GBMMarketSimulationStrategy } from './strategies/gbm-market-simulation.strategy';
import { FlatMarketSimulationStrategy } from './strategies/flat-market-simulation.strategy';
import { NoiseWaveSimulationStrategy } from './strategies/nw-simulation.strategy';

@Module({
  providers: [
    GBMMarketSimulationStrategy,
    FlatMarketSimulationStrategy,
    NoiseWaveSimulationStrategy,
  ],
  exports: [
    GBMMarketSimulationStrategy,
    FlatMarketSimulationStrategy,
    NoiseWaveSimulationStrategy,
  ],
})
export class CommonStrategiesModule {}
