import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../infrastructure/schemas/price-snapshot.schema';
import {
  Stock,
  StockDocument,
} from '../../infrastructure/schemas/stock.schema';
import { MarketRefreshService } from './market-refresh.service';
import { MarketSeedService } from './market-seed.service';

@Injectable()
export class MarketService implements OnModuleInit {
  constructor(
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    @InjectModel(PriceSnapshot.name)
    private readonly snapshotModel: Model<PriceSnapshotDocument>,
    private readonly configService: ConfigService,
    private readonly marketRefreshService: MarketRefreshService,
    private readonly marketSeedService: MarketSeedService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.marketSeedService.seedInitialStocks();

    if (this.configService.get<boolean>('MARKET_FETCH_ON_STARTUP')) {
      await this.marketRefreshService.refreshMarket();
    }
  }

  async listQuotes() {
    return this.stockModel.find().sort({ symbol: 1 }).lean().exec();
  }

  async getQuote(symbol: string) {
    const stock = await this.stockModel
      .findOne({ symbol: symbol.toUpperCase() })
      .lean()
      .exec();

    if (!stock) {
      throw new NotFoundException('La accion solicitada no existe.');
    }

    return stock;
  }

  async getPriceHistory(symbol: string, limit = 24) {
    await this.getQuote(symbol);

    const snapshots = await this.snapshotModel
      .find({ symbol: symbol.toUpperCase() })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return snapshots.reverse();
  }

  async getTopMovers(limit = 4) {
    return this.stockModel
      .find()
      .sort({ dayChangePercentage: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async refreshMarket() {
    return this.marketRefreshService.refreshMarket();
  }
}
