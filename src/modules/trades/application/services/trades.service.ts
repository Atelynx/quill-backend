import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Trade,
  TradeDocument,
} from '../../infrastructure/schemas/trade.schema';

@Injectable()
export class TradesService {
  constructor(
    @InjectModel(Trade.name)
    private readonly tradeModel: Model<TradeDocument>,
  ) {}

  async listUserTrades(userId: string, limit = 20) {
    return this.tradeModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ executedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }
}
