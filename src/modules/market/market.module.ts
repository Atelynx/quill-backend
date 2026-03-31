import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketService } from './application/services/market.service';
import { MockMarketDataProvider } from './infrastructure/providers/mock-market-data.provider';
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
  providers: [MarketService, MockMarketDataProvider, MarketGateway],
  exports: [MarketService, MongooseModule],
})
export class MarketModule {}
