import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CurrencyModule } from '../currency/currency.module';
import { MarketModule } from '../market/market.module';
import { SystemModule } from '../system/system.module';
import {
  Stock,
  StockSchema,
} from '../market/infrastructure/schemas/stock.schema';
import {
  Position,
  PositionSchema,
} from '../portfolio/infrastructure/schemas/position.schema';
import {
  Trade,
  TradeSchema,
} from '../trades/infrastructure/schemas/trade.schema';
import { User, UserSchema } from '../users/infrastructure/schemas/user.schema';
import { CommissionService } from './application/services/commission.service';
import { OrderExecutionService } from './application/services/order-execution.service';
import { OrdersService } from './application/services/orders.service';
import { Order, OrderSchema } from './infrastructure/schemas/order.schema';
import { OrdersController } from './presentation/controllers/orders.controller';

@Module({
  imports: [
    MarketModule,
    SystemModule,
    CurrencyModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Position.name, schema: PositionSchema },
      { name: Stock.name, schema: StockSchema },
      { name: Trade.name, schema: TradeSchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExecutionService, CommissionService],
})
export class OrdersModule {}
