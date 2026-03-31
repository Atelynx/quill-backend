import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Trade, TradeSchema } from './infrastructure/schemas/trade.schema';
import { TradesService } from './application/services/trades.service';
import { TradesController } from './presentation/controllers/trades.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Trade.name, schema: TradeSchema }]),
  ],
  controllers: [TradesController],
  providers: [TradesService],
  exports: [TradesService, MongooseModule],
})
export class TradesModule {}
