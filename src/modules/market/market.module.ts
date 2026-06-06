import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { CommonStrategiesModule } from '../common/common-strategies.module';
import { MarketRefreshScheduler } from './application/services/market-refresh.scheduler';
import { MarketRefreshService } from './application/services/market-refresh.service';
import { MarketSeedService } from './application/services/market-seed.service';
import { MarketService } from './application/services/market.service';
import { MarketTickScheduler } from './application/services/market-tick.scheduler';
import { MarketTickService } from './application/services/market-tick.service';
import { MarketUpdateWriterService } from './application/services/market-update-writer.service';
import { EodhdMarketDataProvider } from './infrastructure/providers/eodhd-market-data.provider';
import { MockMarketDataProvider } from './infrastructure/providers/mock-market-data.provider';
import { NoneMarketDataProvider } from './infrastructure/providers/none-market-data.provider';
import { FallbackMarketDataProvider } from './infrastructure/providers/fallback-market-data.provider';
import { MarketDataProviderFactory } from './infrastructure/providers/market-data-provider.factory';
import {
  PriceSnapshot,
  PriceSnapshotSchema,
} from './infrastructure/schemas/price-snapshot.schema';
import { Stock, StockSchema } from './infrastructure/schemas/stock.schema';
import { GBMMarketSimulationStrategy } from '../common/strategies/gbm-market-simulation.strategy';
import { FlatMarketSimulationStrategy } from '../common/strategies/flat-market-simulation.strategy';
import { MarketController } from './presentation/controllers/market.controller';
import { NoiseWaveSimulationStrategy } from '../common/strategies/nw-simulation.strategy';
import { StrategyFactory } from '../common/strategies/strategy.factory';
import { StrategyType } from '../common/strategies/strategy.types';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Stock.name, schema: StockSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
    ]),
    CommonStrategiesModule,
  ],
  controllers: [MarketController],
  providers: [
    MarketService,
    MarketRefreshService,
    MarketSeedService,
    MarketTickService,
    MarketTickScheduler,
    MarketUpdateWriterService,
    MarketRefreshScheduler,
    MockMarketDataProvider,
    NoneMarketDataProvider,
    EodhdMarketDataProvider,
    FallbackMarketDataProvider,
    {
      /**
       * Factory provider that selects the active MarketDataProvider
       * based on the MARKET_PROVIDER environment variable.
       * When using EODHD, wraps it in a FallbackMarketDataProvider
       * with Mock as fallback for per-symbol resilience.
       */
      provide: 'MARKET_DATA_PROVIDER',
      inject: [
        MockMarketDataProvider,
        EodhdMarketDataProvider,
        NoneMarketDataProvider,
        ConfigService,
      ],
      useFactory: (
        mockProvider: MockMarketDataProvider,
        eodhdProvider: EodhdMarketDataProvider,
        noneProvider: NoneMarketDataProvider,
        configService: ConfigService,
      ) => {
        const providerName = configService.get<string>('MARKET_PROVIDER');

        if (providerName === 'eodhd') {
          return new FallbackMarketDataProvider(eodhdProvider, mockProvider);
        }

        return MarketDataProviderFactory.createProvider(
          providerName,
          mockProvider,
          eodhdProvider,
          noneProvider,
        );
      },
    },
    {
      provide: 'MARKET_SIMULATION_STRATEGY',
      inject: [
        ConfigService,
        GBMMarketSimulationStrategy,
        FlatMarketSimulationStrategy,
        NoiseWaveSimulationStrategy,
      ],
      useFactory: (
        configService: ConfigService,
        gbm: GBMMarketSimulationStrategy,
        flat: FlatMarketSimulationStrategy,
        nw: NoiseWaveSimulationStrategy,
      ) => {
        const strategyName = configService.get<string>(
          'SIMULATION_STRATEGY',
          'flat',
        );
        return StrategyFactory.createStrategy(
          strategyName as StrategyType,
          gbm,
          flat,
          nw,
        );
      },
    },
  ],
  exports: [MarketService, MongooseModule, 'MARKET_DATA_PROVIDER'],
})
export class MarketModule {}
