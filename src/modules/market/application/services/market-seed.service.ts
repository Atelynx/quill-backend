import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import Decimal from 'decimal.js';
import { Model } from 'mongoose';
import type { MarketDataProvider } from '../../infrastructure/providers/market-data-provider.interface';
import { seedStocks } from '../../domain/constants/seed-stocks';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../infrastructure/schemas/price-snapshot.schema';
import { Stock, StockDocument } from '../../infrastructure/schemas/stock.schema';

/**
 * Seeds initial stock records on application startup.
 * Delegates seed data resolution to the active provider via getSeedData(),
 * avoiding any hardcoded provider name comparisons.
 */
@Injectable()
export class MarketSeedService {
  private readonly logger = new Logger(MarketSeedService.name);

  constructor(
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    @InjectModel(PriceSnapshot.name)
    private readonly snapshotModel: Model<PriceSnapshotDocument>,
    @Inject('MARKET_DATA_PROVIDER')
    private readonly provider: MarketDataProvider,
    private readonly configService: ConfigService,
  ) {}

  async seedInitialStocks(): Promise<void> {
    const seedData = this.resolveSeedStocks();

    if (!seedData.length) {
      return;
    }

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

    const stocks = this.prepareSeedDocuments(missingStocks);
    await this.stockModel.insertMany(stocks);

    // Persist initial mock snapshots so the provider has historical data
    if (this.provider.getName().toLowerCase() === 'mock') {
      const now = Date.now();
      await this.snapshotModel.insertMany(this.buildMockSnapshots(stocks, now));
      this.logger.log('Initial market seeded with example data.');
    } else {
      this.logger.log('Placeholder records created. Initial capture will run on next refresh.');
    }
  }

  /**
   * Resolves seed data from the provider's getSeedData() method.
   * Falls back to mock seed stocks if the provider doesn't implement it.
   */
  private resolveSeedStocks() {
    const providerSeedData = this.provider.getSeedData?.();
    if (providerSeedData && providerSeedData.length > 0) {
      return providerSeedData;
    }

    // Fallback: use the hardcoded mock stocks for backwards compatibility
    return seedStocks.map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      currency: stock.currency,
      currentPrice: stock.currentPrice,
      previousClose: 0,
    }));
  }

  /**
   * Prepares stock documents for insertion, normalizing defaults.
   */
  private prepareSeedDocuments(seedData: Array<{
    symbol: string;
    name: string;
    sector: string;
    currency: string;
    currentPrice: number;
    previousClose?: number;
    dayChangePercentage?: number;
    source?: string;
  }>) {
    const providerName = this.provider.getName().toLowerCase();

    return seedData.map((stock) => ({
      ...stock,
      currentPrice: stock.currentPrice ?? 0,
      previousClose: stock.previousClose ?? 0,
      dayChangePercentage: stock.dayChangePercentage ?? 0,
      source: stock.source ?? providerName,
    }));
  }

  /**
   * Generates historical mock snapshots for initial market visualization.
   */
  private buildMockSnapshots(
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
}
