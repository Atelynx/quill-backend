import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import Decimal from 'decimal.js';
import { CurrencyRateService } from '../../../currency/application/services/currency-rate.service';
import {
  Stock,
  StockDocument,
} from '../../../market/infrastructure/schemas/stock.schema';
import {
  Position,
  PositionDocument,
} from '../../../portfolio/infrastructure/schemas/position.schema';
import {
  User,
  UserDocument,
} from '../../../users/infrastructure/schemas/user.schema';
import { CreateOrderDto } from '../../presentation/dto/create-order.dto';
import {
  Order,
  OrderDocument,
} from '../../infrastructure/schemas/order.schema';
import { CommissionService } from './commission.service';
import { OrderExecutionService } from './order-execution.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Position.name)
    private readonly positionModel: Model<PositionDocument>,
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    private readonly commissionService: CommissionService,
    private readonly orderExecutionService: OrderExecutionService,
    private readonly currencyRateService: CurrencyRateService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const symbol = dto.symbol.toUpperCase();

    if (!Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new BadRequestException('La cantidad debe ser un entero positivo.');
    }

    const normalizedQuantity = dto.quantity;
    const type = dto.type ?? 'LIMIT';

    if (type === 'MARKET') {
      dto.limitPrice = undefined;
      return this.orderExecutionService.executeMarketOrder(
        userId,
        symbol,
        dto.side,
        normalizedQuantity,
      );
    }

    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(async () => {
        const user = await this.userModel
          .findById(userId)
          .session(session)
          .exec();
        const stock = await this.stockModel.findOneAndUpdate(
          { symbol },
          { $currentDate: { updatedAt: true } },
          { returnDocument: 'after', session },
        );

        if (!user) throw new NotFoundException('Usuario no encontrado.');
        if (!stock) {
          throw new NotFoundException('La acción solicitada no existe.');
        }

        let reservedAmount = 0;
        if (dto.side === 'BUY') {
          let limitPriceCLP = dto.limitPrice!;
          const stockCurrency = stock.currency ?? 'CLP';
          if (stockCurrency !== 'CLP') {
            const rate = await this.currencyRateService.getRate(
              `${stockCurrency}CLP`,
            );
            if (!rate || !Number.isFinite(rate.rate) || rate.rate <= 0) {
              throw new BadRequestException(
                `Tipo de cambio no disponible para ${stockCurrency}.`,
              );
            }
            limitPriceCLP = new Decimal(dto.limitPrice!)
              .times(rate.rate)
              .toDecimalPlaces(2)
              .toNumber();
          }

          const grossAmount = new Decimal(normalizedQuantity).times(
            limitPriceCLP,
          );
          const commission = await this.commissionService.calculate(
            grossAmount.toNumber(),
          );
          reservedAmount = grossAmount
            .plus(commission)
            .toDecimalPlaces(2)
            .toNumber();

          if (new Decimal(user.availableBalance).lessThan(reservedAmount)) {
            throw new BadRequestException(
              'Saldo insuficiente para reservar la orden.',
            );
          }
          user.availableBalance = new Decimal(user.availableBalance)
            .minus(reservedAmount)
            .toDecimalPlaces(2)
            .toNumber();
          user.reservedBalance = new Decimal(user.reservedBalance)
            .plus(reservedAmount)
            .toDecimalPlaces(2)
            .toNumber();
          await user.save({ session });
        }

        if (dto.side === 'SELL') {
          const position = await this.positionModel
            .findOne({ userId: new Types.ObjectId(userId), symbol })
            .session(session)
            .exec();
          if (
            !position ||
            position.quantity - position.reservedQuantity < normalizedQuantity
          ) {
            throw new BadRequestException(
              'No tienes suficientes acciones disponibles para vender.',
            );
          }
          position.reservedQuantity += normalizedQuantity;
          await position.save({ session });
        }

        const [order] = await this.orderModel.create(
          [
            {
              userId: new Types.ObjectId(userId),
              symbol,
              side: dto.side,
              type: 'LIMIT',
              quantity: normalizedQuantity,
              limitPrice: dto.limitPrice!,
              status: 'PENDING',
              reservedAmount,
            },
          ],
          { session },
        );
        return order;
      });
    } finally {
      await session.endSession();
    }
  }

  async listUserOrders(userId: string, status?: string) {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (status) {
      filter.status = status.toUpperCase();
    }

    return this.orderModel.find(filter).sort({ createdAt: -1 }).lean().exec();
  }

  async cancelOrder(userId: string, orderId: string) {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(async () => {
        const order = await this.orderModel.findOneAndUpdate(
          {
            _id: new Types.ObjectId(orderId),
            userId: new Types.ObjectId(userId),
          },
          { $currentDate: { updatedAt: true } },
          { returnDocument: 'after', session },
        );

        if (!order) {
          throw new NotFoundException('Orden no encontrada.');
        }
        if (order.status === 'CANCELLED') {
          return order;
        }
        if (order.status !== 'PENDING') {
          throw new BadRequestException(
            'Solo se pueden cancelar órdenes pendientes.',
          );
        }

        if (order.side === 'BUY') {
          const user = await this.userModel
            .findById(userId)
            .session(session)
            .exec();
          if (!user) {
            throw new NotFoundException('Usuario no encontrado.');
          }

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
          await user.save({ session });
        } else {
          const position = await this.positionModel
            .findOne({
              userId: new Types.ObjectId(userId),
              symbol: order.symbol,
            })
            .session(session)
            .exec();
          if (position) {
            position.reservedQuantity = Math.max(
              0,
              (position.reservedQuantity ?? 0) - order.quantity,
            );
            await position.save({ session });
          }
        }

        order.status = 'CANCELLED';
        await order.save({ session });
        return order;
      });
    } finally {
      await session.endSession();
    }
  }
}
