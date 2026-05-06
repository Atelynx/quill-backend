import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { EodhdDailyRefreshScheduler } from './application/services/eodhd-daily-refresh.scheduler';
import { MarketRefreshService } from './application/services/market-refresh.service';
import { MarketSeedService } from './application/services/market-seed.service';
import { MarketService } from './application/services/market.service';
import { MarketSnapshotService } from './application/services/market-snapshot.service';
import { MarketUpdateWriterService } from './application/services/market-update-writer.service';
import { EodhdMarketDataProvider } from './infrastructure/providers/eodhd-market-data.provider';
import { MockMarketDataProvider } from './infrastructure/providers/mock-market-data.provider';
import { NoneMarketDataProvider } from './infrastructure/providers/none-market-data.provider';
import { ProviderFactory } from './infrastructure/providers/provider.factory';
import {
  PriceSnapshot,
  PriceSnapshotSchema,
} from './infrastructure/schemas/price-snapshot.schema';
import { Stock, StockSchema } from './infrastructure/schemas/stock.schema';
import { MarketController } from './presentation/controllers/market.controller';
import { MarketGateway } from './presentation/gateways/market.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Stock.name, schema: StockSchema },
      { name: PriceSnapshot.name, schema: PriceSnapshotSchema },
    ]),
  ],
  controllers: [MarketController],
  providers: [
    MarketService,
    MarketRefreshService,
    MarketSeedService,
    MarketSnapshotService,
    MarketUpdateWriterService,
    EodhdDailyRefreshScheduler,
    MockMarketDataProvider,
    NoneMarketDataProvider,
    EodhdMarketDataProvider,
    {
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
        return ProviderFactory.createProvider(
          providerName,
          mockProvider,
          eodhdProvider,
          noneProvider,
        );
      },
    },
    MarketGateway,
  ],
  exports: [MarketService, MongooseModule, 'MARKET_DATA_PROVIDER'],
})
export class MarketModule {}
