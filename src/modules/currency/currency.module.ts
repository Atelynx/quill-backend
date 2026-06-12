import { Module } from '@nestjs/common';
import { CommonStrategiesModule } from '../common/common-strategies.module';
import { CurrencyAnchorService } from './application/services/currency-anchor.service';
import { CurrencyRateService } from './application/services/currency-rate.service';
import { CurrencyTickService } from './application/services/currency-tick.service';
import { CurrencyDataProviderResolver } from './application/services/currency-data-provider.resolver';
import { CurrencyStrategyResolver } from './application/services/currency-strategy.resolver';
import { CurrencyController } from './presentation/controllers/currency.controller';
import { ExchangeRateCurrencyDataProvider } from './infrastructure/providers/exchangeRate-currency-data.provider';
import { MockCurrencyDataProvider } from './infrastructure/providers/mock-currency-data.provider';
import { NoneCurrencyDataProvider } from './infrastructure/providers/none-currency-data.provider';

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
    CurrencyDataProviderResolver,
    CurrencyStrategyResolver,
  ],
})
export class CurrencyModule {}
