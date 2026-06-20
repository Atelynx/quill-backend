import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import Decimal from 'decimal.js';
import { CurrencyRateService } from '../../../currency/application/services/currency-rate.service';
import { isMarketOpen } from '../../../../common/utils/market-hours';
import { MarketService } from '../../../market/application/services/market.service';
import {
  Stock,
  StockDocument,
} from '../../../market/infrastructure/schemas/stock.schema';
import {
  Position,
  PositionDocument,
} from '../../../portfolio/infrastructure/schemas/position.schema';
import { CacheService } from '../../../system/application/services/cache/cache.service';
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
import { randomUUID } from 'crypto';

const EXECUTION_CYCLE_LOCK_KEY = 'lock:orders:execution-cycle';
const EXECUTION_CYCLE_LOCK_TTL_MS = 60_000;

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
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    @InjectModel(Trade.name)
    private readonly tradeModel: Model<TradeDocument>,
    private readonly commissionService: CommissionService,
    private readonly adminConfigService: AdminConfigService,
    private readonly cacheService: CacheService,
    private readonly currencyRateService: CurrencyRateService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleMarketTick(): Promise<void> {
    // Prevent overlapping cycles if an execution takes longer than the interval.
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const lockOwner = randomUUID();
    let lockAcquired = false;
    try {
      lockAcquired = await this.cacheService.acquireLock(
        EXECUTION_CYCLE_LOCK_KEY,
        lockOwner,
        EXECUTION_CYCLE_LOCK_TTL_MS,
      );
      if (!lockAcquired) return;
      await this.executeCycle();
    } catch (error) {
      this.logger.error('Error in market execution cycle', error);
    } finally {
      if (lockAcquired) {
        try {
          await this.cacheService.releaseLock(
            EXECUTION_CYCLE_LOCK_KEY,
            lockOwner,
          );
        } catch (error) {
          this.logger.error('Error releasing market execution lock', error);
        }
      }
      this.isRunning = false;
    }
  }

  private async executeCycle(): Promise<void> {
    if (!(await this.isMarketOpen())) return;
    const quotes = await this.marketService.listQuotes();
    await this.processPendingOrders(quotes);
  }

  private async processPendingOrders(
    quotes: Array<{ symbol: string; close: number; currency?: string }>,
  ): Promise<void> {
    const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));

    const pendingOrders = await this.orderModel
      .find({ status: 'PENDING' })
      .exec();

    for (const order of pendingOrders) {
      const quote = quoteMap.get(order.symbol);
      if (!quote) continue;

      const executablePrice = await this.resolveExecutablePrice(
        order.symbol,
        quote.close,
      );
      if (
        executablePrice !== null &&
        this.shouldExecute(order, executablePrice)
      ) {
        await this.executeOrder(order, executablePrice, quote.currency);
      }
    }
  }

  private async resolveExecutablePrice(
    symbol: string,
    persistedPrice: number,
  ): Promise<number | null> {
    try {
      const livePrice = await this.cacheService.get<number>(
        `stock:${symbol}:live_price`,
      );
      if (this.isValidPrice(livePrice)) {
        return livePrice;
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo consultar el precio vivo de ${symbol}; se usará el precio persistido.`,
        error,
      );
    }

    return this.isValidPrice(persistedPrice) ? persistedPrice : null;
  }

  private isValidPrice(price: unknown): price is number {
    return typeof price === 'number' && Number.isFinite(price) && price > 0;
  }

  private shouldExecute(order: OrderDocument, marketPrice: number): boolean {
    if (order.limitPrice === undefined) return false;
    return order.side === 'BUY'
      ? marketPrice <= order.limitPrice
      : marketPrice >= order.limitPrice;
  }

  private async isMarketOpen(): Promise<boolean> {
    const [openTime, closeTime, closedDays] = await Promise.all([
      this.adminConfigService.get<string>('MARKET_HOURS_OPEN'),
      this.adminConfigService.get<string>('MARKET_HOURS_CLOSED'),
      this.adminConfigService.get<string>('MARKET_CLOSED_DAYS'),
    ]);

    if (!openTime || !closeTime) return true;

    const days = closedDays
      ? closedDays.split(',').map(Number).filter((d) => d >= 1 && d <= 7)
      : [6, 7];

    return isMarketOpen(openTime, closeTime, days);
  }

  private async executeOrder(
    order: OrderDocument,
    marketPrice: number,
    currency?: string,
  ): Promise<void> {
    let executionCurrency: string;
    try {
      executionCurrency = await this.resolveCurrency(order.symbol, currency);
    } catch (error) {
      this.logger.error(`Failed to execute order ${order.id}`, error);
      return;
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const liveOrder = await this.orderModel
          .findById(order.id)
          .session(session)
          .exec();
        const user = await this.userModel
          .findById(order.userId)
          .session(session)
          .exec();

        if (!liveOrder || liveOrder.status !== 'PENDING' || !user) {
          return;
        }

        const grossAmountNative = new Decimal(liveOrder.quantity)
          .times(marketPrice)
          .toDecimalPlaces(2)
          .toNumber();

        const commissionNative =
          await this.commissionService.calculate(grossAmountNative);

        let grossAmountCLP = grossAmountNative;
        let commissionCLP = commissionNative;

        if (executionCurrency !== 'CLP') {
          const rate = await this.getValidRate(executionCurrency);
          const marketPriceCLP = new Decimal(marketPrice)
            .times(rate)
            .toDecimalPlaces(2)
            .toNumber();
          grossAmountCLP = new Decimal(liveOrder.quantity)
            .times(marketPriceCLP)
            .toDecimalPlaces(2)
            .toNumber();
          commissionCLP =
            await this.commissionService.calculate(grossAmountCLP);
        }

        const executedAt = new Date();

        if (liveOrder.side === 'BUY') {
          const totalCostCLP = new Decimal(grossAmountCLP)
            .plus(commissionCLP)
            .toDecimalPlaces(2);
          const totalFunds = new Decimal(user.availableBalance).plus(
            liveOrder.reservedAmount,
          );
          const hasValidReservation = new Decimal(
            user.reservedBalance,
          ).greaterThanOrEqualTo(liveOrder.reservedAmount);

          if (!hasValidReservation || totalFunds.lessThan(totalCostCLP)) {
            await this.cancelUnfundedBuyOrder(session, user, liveOrder);
            return;
          }

          await this.processBuyOrder(
            session,
            user,
            liveOrder,
            grossAmountCLP,
            commissionCLP,
            grossAmountNative,
            marketPrice,
          );
        } else {
          const cancelled = await this.processSellOrder(
            session,
            user,
            liveOrder,
            grossAmountCLP,
            commissionCLP,
          );
          if (cancelled) {
            return;
          }
        }

        await this.finalizeOrder(
          session,
          user,
          liveOrder,
          marketPrice,
          grossAmountNative,
          commissionNative,
          executedAt,
        );
      });
    } catch (error) {
      this.logger.error(`Failed to execute order ${order.id}`, error);
    } finally {
      await session.endSession();
    }
  }

  private async cancelUnfundedBuyOrder(
    session: ClientSession,
    user: UserDocument,
    order: OrderDocument,
  ): Promise<void> {
    const releasableAmount = Decimal.min(
      user.reservedBalance,
      order.reservedAmount,
    ).toDecimalPlaces(2);

    user.reservedBalance = new Decimal(user.reservedBalance)
      .minus(releasableAmount)
      .toDecimalPlaces(2)
      .toNumber();
    user.availableBalance = new Decimal(user.availableBalance)
      .plus(releasableAmount)
      .toDecimalPlaces(2)
      .toNumber();
    order.status = 'CANCELLED';

    await user.save({ session });
    await order.save({ session });
  }

  private async processBuyOrder(
    session: ClientSession,
    user: UserDocument,
    order: OrderDocument,
    grossAmountCLP: number,
    commissionAmountCLP: number,
    grossAmountNative: number,
    marketPriceNative: number,
  ): Promise<void> {
    user.reservedBalance = new Decimal(user.reservedBalance)
      .minus(order.reservedAmount)
      .toDecimalPlaces(2)
      .toNumber();

    user.availableBalance = new Decimal(user.availableBalance)
      .plus(order.reservedAmount)
      .minus(grossAmountCLP)
      .minus(commissionAmountCLP)
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
      const currentTotalCost = new Decimal(existingPosition.quantity).times(
        existingPosition.averageCost,
      );
      const newTotalCost = currentTotalCost.plus(grossAmountNative);
      const newQuantity = existingPosition.quantity + order.quantity;

      existingPosition.quantity = newQuantity;
      existingPosition.averageCost = newTotalCost
        .dividedBy(newQuantity)
        .toDecimalPlaces(2)
        .toNumber();

      await existingPosition.save({ session });
    } else {
      await this.positionModel.create(
        [
          {
            userId: new Types.ObjectId(user.id),
            symbol: order.symbol,
            quantity: order.quantity,
            reservedQuantity: 0,
            averageCost: marketPriceNative,
          },
        ],
        { session },
      );
    }
  }

  private async processSellOrder(
    session: ClientSession,
    user: UserDocument,
    order: OrderDocument,
    grossAmountCLP: number,
    commissionAmountCLP: number,
  ): Promise<boolean> {
    const position = await this.positionModel
      .findOne({
        userId: new Types.ObjectId(user.id),
        symbol: order.symbol,
      })
      .session(session)
      .exec();

    if (!position) {
      await this.cancelIrrecoverableSellOrder(session, user, order);
      return true;
    }

    if (
      position.quantity < order.quantity ||
      (position.reservedQuantity ?? 0) < order.quantity
    ) {
      await this.cancelIrrecoverableSellOrder(session, user, order, position);
      return true;
    }

    position.quantity -= order.quantity;
    position.reservedQuantity = Math.max(
      0,
      (position.reservedQuantity ?? 0) - order.quantity,
    );

    user.availableBalance = new Decimal(user.availableBalance)
      .plus(grossAmountCLP)
      .minus(commissionAmountCLP)
      .toDecimalPlaces(2)
      .toNumber();

    if (position.quantity <= 0) {
      await position.deleteOne({ session });
    } else {
      await position.save({ session });
    }

    return false;
  }

  private async cancelIrrecoverableSellOrder(
    session: ClientSession,
    user: UserDocument,
    order: OrderDocument,
    position?: PositionDocument,
  ): Promise<void> {
    if (position) {
      const releasableQuantity = Math.min(
        position.reservedQuantity ?? 0,
        order.quantity,
      );
      position.reservedQuantity = Math.max(
        0,
        (position.reservedQuantity ?? 0) - releasableQuantity,
      );
      await position.save({ session });
    }

    order.status = 'CANCELLED';
    await user.save({ session });
    await order.save({ session });
  }

  async executeMarketOrder(
    userId: string,
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
  ): Promise<OrderDocument> {
    if (!(await this.isMarketOpen())) {
      throw new BadRequestException(
        'El mercado está cerrado. Las órdenes MARKET solo se ejecutan en horario de mercado.',
      );
    }

    const livePrice = await this.cacheService.get<number>(
      `stock:${symbol}:live_price`,
    );

    if (livePrice === undefined || livePrice === null) {
      throw new NotFoundException(
        `No hay precio disponible para ${symbol}. Intente con una orden LIMIT.`,
      );
    }
    if (!this.isValidPrice(livePrice)) {
      throw new BadRequestException(
        `El precio disponible para ${symbol} no es válido.`,
      );
    }

    const stock = await this.stockModel
      .findOne({ symbol })
      .lean<Pick<Stock, 'currency'>>()
      .exec();

    if (!stock) {
      throw new NotFoundException('La acción solicitada no existe.');
    }

    const grossAmountNative = new Decimal(quantity)
      .times(livePrice)
      .toDecimalPlaces(2)
      .toNumber();

    const commissionNative =
      await this.commissionService.calculate(grossAmountNative);

    let grossAmountCLP = grossAmountNative;
    let commissionCLP = commissionNative;

    const stockCurrency = stock.currency ?? 'CLP';
    if (stockCurrency !== 'CLP') {
      const rate = await this.getValidRate(stockCurrency);
      const livePriceCLP = new Decimal(livePrice)
        .times(rate)
        .toDecimalPlaces(2)
        .toNumber();
      grossAmountCLP = new Decimal(quantity)
        .times(livePriceCLP)
        .toDecimalPlaces(2)
        .toNumber();
      commissionCLP = await this.commissionService.calculate(grossAmountCLP);
    }
    this.assertValidMarketAmounts(
      grossAmountNative,
      commissionNative,
      grossAmountCLP,
      commissionCLP,
    );

    const session = await this.connection.startSession();
    try {
      const [executedOrder] = await session.withTransaction(async () => {
        const user = await this.userModel
          .findById(userId)
          .session(session)
          .exec();

        if (!user) {
          throw new NotFoundException('Usuario no encontrado.');
        }

        const lockedStock = await this.stockModel.findOneAndUpdate(
          { symbol },
          { $currentDate: { updatedAt: true } },
          { returnDocument: 'after', session },
        );
        if (!lockedStock) {
          throw new NotFoundException('La acción solicitada no existe.');
        }

        const executedAt = new Date();

        if (side === 'BUY') {
          const totalCostCLP = new Decimal(grossAmountCLP)
            .plus(commissionCLP)
            .toDecimalPlaces(2)
            .toNumber();

          if (new Decimal(user.availableBalance).lessThan(totalCostCLP)) {
            throw new BadRequestException(
              'Saldo insuficiente para ejecutar la orden.',
            );
          }

          user.availableBalance = new Decimal(user.availableBalance)
            .minus(totalCostCLP)
            .toDecimalPlaces(2)
            .toNumber();

          const existingPosition = await this.positionModel
            .findOne({
              userId: new Types.ObjectId(user.id),
              symbol,
            })
            .session(session)
            .exec();

          if (existingPosition) {
            const currentTotalCost = new Decimal(
              existingPosition.quantity,
            ).times(existingPosition.averageCost);
            const newTotalCost = currentTotalCost.plus(grossAmountNative);
            const newQuantity = existingPosition.quantity + quantity;

            existingPosition.quantity = newQuantity;
            existingPosition.averageCost = newTotalCost
              .dividedBy(newQuantity)
              .toDecimalPlaces(2)
              .toNumber();

            await existingPosition.save({ session });
          } else {
            await this.positionModel.create(
              [
                {
                  userId: new Types.ObjectId(user.id),
                  symbol,
                  quantity,
                  reservedQuantity: 0,
                  averageCost: livePrice,
                },
              ],
              { session },
            );
          }
        }

        if (side === 'SELL') {
          const position = await this.positionModel
            .findOne({
              userId: new Types.ObjectId(user.id),
              symbol,
            })
            .session(session)
            .exec();

          if (
            !position ||
            position.quantity - (position.reservedQuantity ?? 0) < quantity
          ) {
            throw new BadRequestException(
              'No tienes suficientes acciones para vender.',
            );
          }

          position.quantity -= quantity;

          user.availableBalance = new Decimal(user.availableBalance)
            .plus(grossAmountCLP)
            .minus(commissionCLP)
            .toDecimalPlaces(2)
            .toNumber();

          if (position.quantity <= 0) {
            await position.deleteOne({ session });
          } else {
            await position.save({ session });
          }
        }

        const netAmountNative =
          side === 'BUY'
            ? new Decimal(grossAmountNative)
                .plus(commissionNative)
                .toDecimalPlaces(2)
                .toNumber()
            : new Decimal(grossAmountNative)
                .minus(commissionNative)
                .toDecimalPlaces(2)
                .toNumber();

        const [order] = await this.orderModel.create(
          [
            {
              userId: new Types.ObjectId(user.id),
              symbol,
              side,
              quantity,
              type: 'MARKET' as const,
              status: 'EXECUTED' as const,
              reservedAmount: 0,
              executionPrice: livePrice,
              commissionAmount: commissionNative,
              executedAt,
            },
          ],
          { session },
        );

        await this.tradeModel.create(
          [
            {
              userId: new Types.ObjectId(user.id),
              orderId: new Types.ObjectId(order.id),
              symbol,
              side,
              quantity,
              executionPrice: livePrice,
              grossAmount: grossAmountNative,
              commissionAmount: commissionNative,
              netAmount: netAmountNative,
              executedAt,
            },
          ],
          { session },
        );

        await user.save({ session });

        return [order];
      });

      return executedOrder;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(`Failed to execute market order for ${symbol}`, error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async finalizeOrder(
    session: ClientSession,
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

    const netAmount =
      order.side === 'BUY'
        ? new Decimal(grossAmount)
            .plus(commissionAmount)
            .toDecimalPlaces(2)
            .toNumber()
        : new Decimal(grossAmount)
            .minus(commissionAmount)
            .toDecimalPlaces(2)
            .toNumber();

    await user.save({ session });
    await order.save({ session });
    await this.tradeModel.create(
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
    );
  }

  private async getValidRate(currency: string): Promise<number> {
    const pair = `${currency}CLP`;
    const entry = await this.currencyRateService.getRate(pair);

    if (!entry || !Number.isFinite(entry.rate) || entry.rate <= 0) {
      throw new BadRequestException(
        `Tipo de cambio válido no disponible para ${pair}.`,
      );
    }

    return entry.rate;
  }

  private assertValidMarketAmounts(
    grossAmountNative: number,
    commissionNative: number,
    grossAmountCLP: number,
    commissionCLP: number,
  ): void {
    const validCommission = (commission: number, grossAmount: number) =>
      Number.isFinite(commission) &&
      commission >= 0 &&
      commission <= grossAmount;

    if (
      !this.isValidPrice(grossAmountNative) ||
      !this.isValidPrice(grossAmountCLP) ||
      !validCommission(commissionNative, grossAmountNative) ||
      !validCommission(commissionCLP, grossAmountCLP)
    ) {
      throw new BadRequestException(
        'No se pudo calcular un monto válido para ejecutar la orden.',
      );
    }
  }

  private async resolveCurrency(
    symbol: string,
    quoteCurrency?: string,
  ): Promise<string> {
    if (quoteCurrency) {
      return quoteCurrency.toUpperCase();
    }

    const stock = await this.stockModel
      .findOne({ symbol })
      .lean<Pick<Stock, 'currency'>>()
      .exec();
    if (!stock?.currency) {
      throw new BadRequestException(
        `Moneda no disponible para ejecutar la orden de ${symbol}.`,
      );
    }

    return stock.currency.toUpperCase();
  }
}
