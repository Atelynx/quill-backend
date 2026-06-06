import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonStrategiesModule } from '../common/common-strategies.module';
import { CurrencyAnchorService } from './application/services/currency-anchor.service';
import { CurrencyRateService } from './application/services/currency-rate.service';
import { CurrencyTickService } from './application/services/currency-tick.service';
import { CurrencyController } from './presentation/controllers/currency.controller';
import { ExchangeRateCurrencyDataProvider } from './infrastructure/providers/exchangeRate-currency-data.provider';
import { MockCurrencyDataProvider } from './infrastructure/providers/mock-currency-data.provider';
import { NoneCurrencyDataProvider } from './infrastructure/providers/none-currency-data.provider';
import { FallbackCurrencyDataProvider } from './infrastructure/providers/fallback-currency-data.provider';
import { CurrencyProviderFactory } from './infrastructure/providers/currency-provider.factory';
import { GBMMarketSimulationStrategy } from '../common/strategies/gbm-market-simulation.strategy';
import { FlatMarketSimulationStrategy } from '../common/strategies/flat-market-simulation.strategy';
import { NoiseWaveSimulationStrategy } from '../common/strategies/nw-simulation.strategy';
import { StrategyFactory } from '../common/strategies/strategy.factory';
import { StrategyType } from '../common/strategies/strategy.types';

@Module({
  imports: [CommonStrategiesModule],
  controllers: [CurrencyController],
  exports: [CurrencyRateService],
  providers: [
    CurrencyAnchorService,
    CurrencyRateService,
    CurrencyTickService,
    MockCurrencyDataProvider,
    ExchangeRateCurrencyDataProvider,
    NoneCurrencyDataProvider,
    {
      provide: 'CURRENCY_DATA_PROVIDER',
      inject: [
        MockCurrencyDataProvider,
        ExchangeRateCurrencyDataProvider,
        NoneCurrencyDataProvider,
        ConfigService,
      ],
      useFactory: (
        mockProvider: MockCurrencyDataProvider,
        exchangeRateProvider: ExchangeRateCurrencyDataProvider,
        noneProvider: NoneCurrencyDataProvider,
        configService: ConfigService,
      ) => {
        const providerName = configService.get<string>('CURRENCY_PROVIDER');

        if (providerName === 'exchangeRate') {
          return new FallbackCurrencyDataProvider(
            exchangeRateProvider,
            mockProvider,
          );
        }

        return CurrencyProviderFactory.createProvider(
          providerName,
          mockProvider,
          exchangeRateProvider,
          noneProvider,
        );
      },
    },
    {
      provide: 'CURRENCY_SIMULATION_STRATEGY',
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
          'CURRENCY_SIMULATION_STRATEGY',
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
})
export class CurrencyModule {}
