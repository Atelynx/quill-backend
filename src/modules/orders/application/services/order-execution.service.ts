import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Decimal } from 'decimal.js';
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
export class OrderExecutionService {
  private readonly logger = new Logger(OrderExecutionService.name);
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
  ) { }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleMarketTick(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      await this.executeCycle();
    } catch (error) {
      this.logger.error('Error in market execution cycle', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async executeCycle(): Promise<void> {
    const quotes = await this.marketService.refreshMarket();
    const quoteMap = new Map(
      quotes.map((quote) => [quote.symbol, quote.currentPrice]),
    );

    const pendingOrders = await this.orderModel
      .find({ status: 'PENDING' })
      .exec();

    for (const order of pendingOrders) {
      const marketPrice = quoteMap.get(order.symbol);

      if (marketPrice && this.shouldExecute(order, marketPrice)) {
        await this.executeOrder(order, marketPrice);
      }
    }
  }

  private shouldExecute(order: OrderDocument, marketPrice: number): boolean {
    return order.side === 'BUY'
      ? marketPrice <= order.limitPrice
      : marketPrice >= order.limitPrice;
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

        const grossAmount = new Decimal(liveOrder.quantity)
          .times(marketPrice)
          .toDecimalPlaces(2)
          .toNumber();
        
        const commissionAmount = this.commissionService.calculate(grossAmount);
        const executedAt = new Date();

        if (liveOrder.side === 'BUY') {
          await this.processBuyOrder(
            session,
            user,
            liveOrder,
            grossAmount,
            commissionAmount,
            marketPrice,
          );
        } else {
          await this.processSellOrder(
            session,
            user,
            liveOrder,
            grossAmount,
            commissionAmount,
          );
        }

        await this.finalizeOrder(
          session,
          user,
          liveOrder,
          marketPrice,
          grossAmount,
          commissionAmount,
          executedAt,
        );
      });
    } catch (error) {
      this.logger.error(`Failed to execute order ${order.id}`, error);
    } finally {
      await session.endSession();
    }
  }

  private async processBuyOrder(
    session: any,
    user: UserDocument,
    order: OrderDocument,
    grossAmount: number,
    commissionAmount: number,
    marketPrice: number,
  ): Promise<void> {
    user.reservedBalance = new Decimal(user.reservedBalance)
      .minus(order.reservedAmount)
      .toDecimalPlaces(2)
      .toNumber();

    user.availableBalance = new Decimal(user.availableBalance)
      .plus(order.reservedAmount)
      .minus(grossAmount)
      .minus(commissionAmount)
      .toDecimalPlaces(2)
      .toNumber();

    const existingPosition = await this.positionModel
      .findOne({
        userId: new Types.ObjectId(user.id),
        symbol: order.symbol,
      })
      .session(session)
      .exec();

    if (existingPosition) {
      const currentTotalCost = new Decimal(existingPosition.quantity).times(existingPosition.averageCost);
      const newTotalCost = currentTotalCost.plus(grossAmount);
      const newQuantity = existingPosition.quantity + order.quantity;
      
      existingPosition.quantity = newQuantity;
      existingPosition.averageCost = newTotalCost.dividedBy(newQuantity).toDecimalPlaces(2).toNumber();
      
      await existingPosition.save({ session });
    } else {
      await this.positionModel.create(
        [
          {
            userId: new Types.ObjectId(user.id),
            symbol: order.symbol,
            quantity: order.quantity,
            reservedQuantity: 0,
            averageCost: marketPrice,
          },
        ],
        { session },
      );
    }
  }

  private async processSellOrder(
    session: any,
    user: UserDocument,
    order: OrderDocument,
    grossAmount: number,
    commissionAmount: number,
  ): Promise<void> {
    const position = await this.positionModel
      .findOne({
        userId: new Types.ObjectId(user.id),
        symbol: order.symbol,
      })
      .session(session)
      .exec();

    if (!position) {
      throw new Error(`Position not found for symbol ${order.symbol}`);
    }

    position.quantity -= order.quantity;
    position.reservedQuantity -= order.quantity;
    
    user.availableBalance = new Decimal(user.availableBalance)
      .plus(grossAmount)
      .minus(commissionAmount)
      .toDecimalPlaces(2)
      .toNumber();

    if (position.quantity <= 0) {
      await position.deleteOne({ session });
    } else {
      await position.save({ session });
    }
  }

  private async finalizeOrder(
    session: any,
    user: UserDocument,
    order: OrderDocument,
    marketPrice: number,
    grossAmount: number,
    commissionAmount: number,
    executedAt: Date,
  ): Promise<void> {
    order.status = 'EXECUTED';
    order.executionPrice = marketPrice;
    order.commissionAmount = commissionAmount;
    order.executedAt = executedAt;

    const netAmount = order.side === 'BUY'
      ? new Decimal(grossAmount).plus(commissionAmount).toDecimalPlaces(2).toNumber()
      : new Decimal(grossAmount).minus(commissionAmount).toDecimalPlaces(2).toNumber();

    await Promise.all([
      user.save({ session }),
      order.save({ session }),
      this.tradeModel.create(
        [
          {
            userId: new Types.ObjectId(user.id),
            orderId: new Types.ObjectId(order.id),
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity,
            executionPrice: marketPrice,
            grossAmount,
            commissionAmount,
            netAmount,
            executedAt,
          },
        ],
        { session },
      ),
    ]);
  }
}
