import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import Decimal from 'decimal.js';
import { Model } from 'mongoose';
import { seedStocks } from '../../domain/constants/seed-stocks';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../infrastructure/schemas/price-snapshot.schema';
import { Stock, StockDocument } from '../../infrastructure/schemas/stock.schema';

@Injectable()
export class MarketSeedService {
  private readonly logger = new Logger(MarketSeedService.name);

  constructor(
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    @InjectModel(PriceSnapshot.name)
    private readonly snapshotModel: Model<PriceSnapshotDocument>,
    private readonly configService: ConfigService,
  ) {}

  async seedInitialStocks(): Promise<void> {
    const seedData = this.resolveSeedStocks();
    const symbols = seedData.map((stock) => stock.symbol);
    const existingStocks = await this.stockModel
      .find({ symbol: { $in: symbols } })
      .select('symbol')
      .lean()
      .exec();
    const existingSymbols = new Set(
      existingStocks.map((stock) => stock.symbol.toUpperCase()),
    );
    const missingStocks = seedData.filter(
      (stock) => !existingSymbols.has(stock.symbol),
    );

    if (!missingStocks.length) {
      return;
    }

    const now = Date.now();
    const stocks = missingStocks.map((stock) => {
      const previousClose = new Decimal(stock.currentPrice)
        .times(0.985)
        .toDecimalPlaces(2)
        .toNumber();

      return {
        ...stock,
        previousClose,
        dayChangePercentage: 1.5,
        source: 'mock',
      };
    });

    await this.stockModel.insertMany(stocks);
    await this.snapshotModel.insertMany(this.buildSnapshots(stocks, now));
    this.logger.log('Mercado inicial sembrado con datos de ejemplo.');
  }

  private buildSnapshots(
    stocks: Array<{ symbol: string; currentPrice: number }>,
    now: number,
  ) {
    return stocks.flatMap((stock) =>
      Array.from({ length: 24 }, (_, index) => {
        const factor = new Decimal(1).plus(new Decimal(index - 12).times(0.0015));

        return {
          symbol: stock.symbol,
          source: 'mock',
          price: new Decimal(stock.currentPrice)
            .times(factor)
            .toDecimalPlaces(2)
            .toNumber(),
          createdAt: new Date(now - (24 - index) * 60 * 60 * 1000),
        };
      }),
    );
  }

  private resolveSeedStocks() {
    const provider = this.configService.get<string>('MARKET_PROVIDER', 'mock');

    if (provider.toLowerCase() !== 'eodhd') {
      return seedStocks;
    }

    const symbols = this.configService
      .get<string>('EODHD_SYMBOLS', '')
      .split(',')
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);

    return symbols.map((symbol) => ({
      symbol,
      name: symbol,
      sector: 'Mercado chileno',
      currency: 'CLP',
      currentPrice: 100,
    }));
  }
}
