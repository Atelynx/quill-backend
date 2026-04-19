import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { MarketService } from './application/services/market.service';
import { MockMarketDataProvider } from './infrastructure/providers/mock-market-data.provider';
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
    MockMarketDataProvider,
    {
      provide: 'MARKET_DATA_PROVIDER',
      inject: [MockMarketDataProvider, ConfigService],
      useFactory: (
        mockProvider: MockMarketDataProvider,
        configService: ConfigService,
      ) => {
        const providerName = configService.get('MARKET_PROVIDER', 'mock');
        return ProviderFactory.createProvider(providerName, mockProvider);
      },
    },
    MarketGateway,
  ],
  exports: [MarketService, MongooseModule, 'MARKET_DATA_PROVIDER'],
})
export class MarketModule {}
