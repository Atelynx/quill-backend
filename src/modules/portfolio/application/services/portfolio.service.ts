import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../../../users/application/services/users.service';
import {
  Stock,
  StockDocument,
} from '../../../market/infrastructure/schemas/stock.schema';
import {
  Position,
  PositionDocument,
} from '../../infrastructure/schemas/position.schema';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectModel(Position.name)
    private readonly positionModel: Model<PositionDocument>,
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    private readonly usersService: UsersService,
  ) {}

  async getSummary(userId: string) {
    const [user, positions, quotes] = await Promise.all([
      this.usersService.findById(userId),
      this.positionModel
        .find({ userId: new Types.ObjectId(userId) })
        .lean()
        .exec(),
      this.stockModel.find().lean().exec(),
    ]);

    const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));

    const enrichedPositions = positions
      .filter((position) => position.quantity > 0)
      .map((position) => {
        const quote = quoteMap.get(position.symbol);
        const marketPrice = quote?.currentPrice ?? 0;
        const marketValue = Number(
          (position.quantity * marketPrice).toFixed(2),
        );
        const costBasis = Number(
          (position.quantity * position.averageCost).toFixed(2),
        );
        const unrealizedProfitLoss = Number(
          (marketValue - costBasis).toFixed(2),
        );

        return {
          symbol: position.symbol,
          quantity: position.quantity,
          reservedQuantity: position.reservedQuantity,
          averageCost: position.averageCost,
          marketPrice,
          marketValue,
          unrealizedProfitLoss,
        };
      });

    const investedValue = Number(
      enrichedPositions
        .reduce((acc, position) => acc + position.marketValue, 0)
        .toFixed(2),
    );
    const unrealizedProfitLoss = Number(
      enrichedPositions
        .reduce((acc, position) => acc + position.unrealizedProfitLoss, 0)
        .toFixed(2),
    );

    return {
      availableBalance: user.availableBalance,
      reservedBalance: user.reservedBalance,
      investedValue,
      totalEquity: Number((user.availableBalance + investedValue).toFixed(2)),
      unrealizedProfitLoss,
      positions: enrichedPositions,
    };
  }
}
