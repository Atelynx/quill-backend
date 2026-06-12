import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonStrategiesModule } from '../common/common-strategies.module';
import { MarketRefreshScheduler } from './application/services/market-refresh.scheduler';
import { MarketRefreshService } from './application/services/market-refresh.service';
import { MarketSeedService } from './application/services/market-seed.service';
import { MarketService } from './application/services/market.service';
import { MarketTickScheduler } from './application/services/market-tick.scheduler';
import { MarketTickService } from './application/services/market-tick.service';
import { MarketUpdateWriterService } from './application/services/market-update-writer.service';
import { MarketDataProviderResolver } from './application/services/market-data-provider.resolver';
import { MarketStrategyResolver } from './application/services/market-strategy.resolver';
import { EodhdMarketDataProvider } from './infrastructure/providers/eodhd-market-data.provider';
import { MockMarketDataProvider } from './infrastructure/providers/mock-market-data.provider';
import { NoneMarketDataProvider } from './infrastructure/providers/none-market-data.provider';
import { MarketDataProviderFactory } from './infrastructure/providers/market-data-provider.factory';
import {
  PriceSnapshot,
  PriceSnapshotSchema,
} from './infrastructure/schemas/price-snapshot.schema';
import { Stock, StockSchema } from './infrastructure/schemas/stock.schema';
import { MarketController } from './presentation/controllers/market.controller';

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
    MarketDataProviderResolver,
    MarketStrategyResolver,
  ],
  exports: [MarketService, MongooseModule],
})
export class MarketModule {}
