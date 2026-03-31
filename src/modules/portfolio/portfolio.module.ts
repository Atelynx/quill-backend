import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Stock,
  StockSchema,
} from '../market/infrastructure/schemas/stock.schema';
import { UsersModule } from '../users/users.module';
import { PortfolioService } from './application/services/portfolio.service';
import {
  Position,
  PositionSchema,
} from './infrastructure/schemas/position.schema';
import { PortfolioController } from './presentation/controllers/portfolio.controller';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Position.name, schema: PositionSchema },
      { name: Stock.name, schema: StockSchema },
    ]),
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService, MongooseModule],
})
export class PortfolioModule {}
