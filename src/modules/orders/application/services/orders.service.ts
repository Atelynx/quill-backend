import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Position.name)
    private readonly positionModel: Model<PositionDocument>,
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    private readonly commissionService: CommissionService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const symbol = dto.symbol.toUpperCase();
    const [user, stock] = await Promise.all([
      this.userModel.findById(userId).exec(),
      this.stockModel.findOne({ symbol }).exec(),
    ]);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!stock) {
      throw new NotFoundException('La acción solicitada no existe.');
    }

    const normalizedQuantity = Math.floor(dto.quantity);

    if (normalizedQuantity < 1) {
      throw new BadRequestException('La cantidad debe ser un entero positivo.');
    }

    let reservedAmount = 0;

    if (dto.side === 'BUY') {
      const grossAmount = normalizedQuantity * dto.limitPrice;
      const estimatedCommission = this.commissionService.calculate(grossAmount);
      reservedAmount = Number((grossAmount + estimatedCommission).toFixed(2));

      if (user.availableBalance < reservedAmount) {
        throw new BadRequestException(
          'Saldo insuficiente para reservar la orden.',
        );
      }

      user.availableBalance = Number(
        (user.availableBalance - reservedAmount).toFixed(2),
      );
      user.reservedBalance = Number(
        (user.reservedBalance + reservedAmount).toFixed(2),
      );
      await user.save();
    }

    if (dto.side === 'SELL') {
      const position = await this.positionModel
        .findOne({ userId: new Types.ObjectId(userId), symbol })
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
      await position.save();
    }

    return this.orderModel.create({
      userId: new Types.ObjectId(userId),
      symbol,
      side: dto.side,
      quantity: normalizedQuantity,
      limitPrice: dto.limitPrice,
      status: 'PENDING',
      reservedAmount,
    });
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
}
