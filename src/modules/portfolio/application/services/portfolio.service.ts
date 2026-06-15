import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Decimal from 'decimal.js';
import { CurrencyRateService } from '../../../currency/application/services/currency-rate.service';
import {
  Stock,
  StockDocument,
} from '../../../market/infrastructure/schemas/stock.schema';
import {
  Position,
  PositionDocument,
} from '../../infrastructure/schemas/position.schema';
import { UsersService } from '../../../users/application/services/users.service';

@Injectable()
export class PortfolioService {
  private readonly rateCache = new Map<string, number | null>();

  constructor(
    @InjectModel(Position.name)
    private readonly positionModel: Model<PositionDocument>,
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    private readonly usersService: UsersService,
    private readonly currencyRateService: CurrencyRateService,
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

    this.rateCache.clear();
    const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));

    let investedValueCLP = new Decimal(0);
    let unrealizedProfitLossTotalCLP = new Decimal(0);
    const enrichedPositions: Array<{
      symbol: string;
      quantity: number;
      reservedQuantity: number;
      averageCost: number;
      marketPrice: number;
      marketValue: number;
      unrealizedProfitLoss: number;
    }> = [];

    for (const position of positions) {
      if (position.quantity <= 0) continue;

      const quote = quoteMap.get(position.symbol);
      const marketPrice = quote?.close ?? 0;
      const currency = quote?.currency ?? 'CLP';

      const marketValueNative = new Decimal(position.quantity)
        .times(marketPrice)
        .toDecimalPlaces(2)
        .toNumber();

      const costBasis = new Decimal(position.quantity)
        .times(position.averageCost)
        .toDecimalPlaces(2)
        .toNumber();

      const unrealizedPnlNative = new Decimal(marketValueNative)
        .minus(costBasis)
        .toDecimalPlaces(2)
        .toNumber();

      let marketValueCLP = marketValueNative;
      let unrealizedPnlCLP = unrealizedPnlNative;

      if (currency !== 'CLP') {
        const rate = await this.getRate(currency);
        if (rate === null) {
          throw new ServiceUnavailableException(
            `Tipo de cambio no disponible para ${currency}.`,
          );
        }
        marketValueCLP = new Decimal(marketValueNative)
          .times(rate)
          .toDecimalPlaces(2)
          .toNumber();
        unrealizedPnlCLP = new Decimal(unrealizedPnlNative)
          .times(rate)
          .toDecimalPlaces(2)
          .toNumber();
      }

      investedValueCLP = investedValueCLP.plus(marketValueCLP);
      unrealizedProfitLossTotalCLP =
        unrealizedProfitLossTotalCLP.plus(unrealizedPnlCLP);

      enrichedPositions.push({
        symbol: position.symbol,
        quantity: position.quantity,
        reservedQuantity: position.reservedQuantity,
        averageCost: position.averageCost,
        marketPrice,
        marketValue: marketValueNative,
        unrealizedProfitLoss: unrealizedPnlNative,
      });
    }

    return {
      availableBalance: user.availableBalance,
      reservedBalance: user.reservedBalance,
      investedValue: investedValueCLP.toDecimalPlaces(2).toNumber(),
      totalEquity: new Decimal(user.availableBalance)
        .plus(user.reservedBalance)
        .plus(investedValueCLP)
        .toDecimalPlaces(2)
        .toNumber(),
      unrealizedProfitLoss: unrealizedProfitLossTotalCLP
        .toDecimalPlaces(2)
        .toNumber(),
      positions: enrichedPositions,
    };
  }

  private async getRate(currency: string): Promise<number | null> {
    if (this.rateCache.has(currency)) {
      return this.rateCache.get(currency)!;
    }
    const rate = await this.currencyRateService.getRate(`${currency}CLP`);
    const result = rate?.rate ?? null;
    this.rateCache.set(currency, result);
    return result;
  }
}
