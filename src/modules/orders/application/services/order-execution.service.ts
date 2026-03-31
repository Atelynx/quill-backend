import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { MarketService } from '../../../market/application/services/market.service';
import {
  Position,
  PositionDocument,
} from '../../../portfolio/infrastructure/schemas/position.schema';
import {
  Trade,
  TradeDocument,
} from '../../../trades/infrastructure/schemas/trade.schema';
import {
  User,
  UserDocument,
} from '../../../users/infrastructure/schemas/user.schema';
import {
  Order,
  OrderDocument,
} from '../../infrastructure/schemas/order.schema';
import { CommissionService } from './commission.service';

@Injectable()
export class OrderExecutionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExecutionService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly marketService: MarketService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Position.name)
    private readonly positionModel: Model<PositionDocument>,
    @InjectModel(Trade.name)
    private readonly tradeModel: Model<TradeDocument>,
    private readonly commissionService: CommissionService,
  ) {}

  onModuleInit(): void {
    const seconds = this.configService.get<number>(
      'MARKET_TICK_INTERVAL_SECONDS',
      15,
    );
    this.intervalRef = setInterval(() => {
      void this.executeCycle();
    }, seconds * 1000);
  }

  onModuleDestroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
  }

  private async executeCycle(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const quotes = await this.marketService.refreshMarket();
      const quoteMap = new Map(
        quotes.map((quote) => [quote.symbol, quote.currentPrice]),
      );
      const pendingOrders = await this.orderModel
        .find({ status: 'PENDING' })
        .exec();

      for (const order of pendingOrders) {
        const marketPrice = quoteMap.get(order.symbol);

        if (!marketPrice || !this.shouldExecute(order, marketPrice)) {
          continue;
        }

        await this.executeOrder(order, marketPrice);
      }
    } catch (error) {
      this.logger.error('No fue posible ejecutar el ciclo de mercado.', error);
    } finally {
      this.isRunning = false;
    }
  }

  private shouldExecute(order: OrderDocument, marketPrice: number): boolean {
    if (order.side === 'BUY') {
      return marketPrice <= order.limitPrice;
    }

    return marketPrice >= order.limitPrice;
  }

  private async executeOrder(
    order: OrderDocument,
    marketPrice: number,
  ): Promise<void> {
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        const [liveOrder, user] = await Promise.all([
          this.orderModel.findById(order.id).session(session).exec(),
          this.userModel.findById(order.userId).session(session).exec(),
        ]);

        if (!liveOrder || liveOrder.status !== 'PENDING' || !user) {
          return;
        }

        const grossAmount = Number(
          (liveOrder.quantity * marketPrice).toFixed(2),
        );
        const commissionAmount = this.commissionService.calculate(grossAmount);
        const executedAt = new Date();

        if (liveOrder.side === 'BUY') {
          user.reservedBalance = Number(
            (user.reservedBalance - liveOrder.reservedAmount).toFixed(2),
          );
          user.availableBalance = Number(
            (
              user.availableBalance +
              liveOrder.reservedAmount -
              grossAmount -
              commissionAmount
            ).toFixed(2),
          );

          const existingPosition = await this.positionModel
            .findOne({
              userId: new Types.ObjectId(user.id),
              symbol: liveOrder.symbol,
            })
            .session(session)
            .exec();

          if (existingPosition) {
            const totalCost =
              existingPosition.quantity * existingPosition.averageCost +
              grossAmount;
            existingPosition.quantity += liveOrder.quantity;
            existingPosition.averageCost = Number(
              (totalCost / existingPosition.quantity).toFixed(2),
            );
            await existingPosition.save({ session });
          } else {
            await this.positionModel.create(
              [
                {
                  userId: new Types.ObjectId(user.id),
                  symbol: liveOrder.symbol,
                  quantity: liveOrder.quantity,
                  reservedQuantity: 0,
                  averageCost: marketPrice,
                },
              ],
              { session },
            );
          }
        }

        if (liveOrder.side === 'SELL') {
          const position = await this.positionModel
            .findOne({
              userId: new Types.ObjectId(user.id),
              symbol: liveOrder.symbol,
            })
            .session(session)
            .exec();

          if (!position) {
            return;
          }

          position.quantity -= liveOrder.quantity;
          position.reservedQuantity -= liveOrder.quantity;
          user.availableBalance = Number(
            (user.availableBalance + grossAmount - commissionAmount).toFixed(2),
          );

          if (position.quantity <= 0) {
            await position.deleteOne({ session });
          } else {
            await position.save({ session });
          }
        }

        liveOrder.status = 'EXECUTED';
        liveOrder.executionPrice = marketPrice;
        liveOrder.commissionAmount = commissionAmount;
        liveOrder.executedAt = executedAt;

        await Promise.all([
          user.save({ session }),
          liveOrder.save({ session }),
          this.tradeModel.create(
            [
              {
                userId: new Types.ObjectId(user.id),
                orderId: new Types.ObjectId(liveOrder.id),
                symbol: liveOrder.symbol,
                side: liveOrder.side,
                quantity: liveOrder.quantity,
                executionPrice: marketPrice,
                grossAmount,
                commissionAmount,
                netAmount:
                  liveOrder.side === 'BUY'
                    ? Number((grossAmount + commissionAmount).toFixed(2))
                    : Number((grossAmount - commissionAmount).toFixed(2)),
                executedAt,
              },
            ],
            { session },
          ),
        ]);
      });
    } finally {
      await session.endSession();
    }
  }
}
