import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Decimal } from 'decimal.js';
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
        
        const marketValue = new Decimal(position.quantity)
          .times(marketPrice)
          .toDecimalPlaces(2)
          .toNumber();
          
        const costBasis = new Decimal(position.quantity)
          .times(position.averageCost)
          .toDecimalPlaces(2)
          .toNumber();
          
        const unrealizedProfitLoss = new Decimal(marketValue)
          .minus(costBasis)
          .toDecimalPlaces(2)
          .toNumber();

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

    const investedValue = enrichedPositions
      .reduce((acc, pos) => acc.plus(pos.marketValue), new Decimal(0))
      .toDecimalPlaces(2)
      .toNumber();
      
    const unrealizedProfitLossTotal = enrichedPositions
      .reduce((acc, pos) => acc.plus(pos.unrealizedProfitLoss), new Decimal(0))
      .toDecimalPlaces(2)
      .toNumber();

    return {
      availableBalance: user.availableBalance,
      reservedBalance: user.reservedBalance,
      investedValue,
      totalEquity: new Decimal(user.availableBalance)
        .plus(investedValue)
        .toDecimalPlaces(2)
        .toNumber(),
      unrealizedProfitLoss: unrealizedProfitLossTotal,
      positions: enrichedPositions,
    };
  }
}
