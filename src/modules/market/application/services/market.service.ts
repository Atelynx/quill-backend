import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model } from 'mongoose';
import Decimal from 'decimal.js';
import type { MarketDataProvider } from '../../infrastructure/providers/market-data-provider.interface';
import { CacheService } from '../../../system/application/services/cache.service';
import { seedStocks } from '../../domain/constants/seed-stocks';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../infrastructure/schemas/price-snapshot.schema';
import {
  Stock,
  StockDocument,
} from '../../infrastructure/schemas/stock.schema';
import { MarketGateway } from '../../presentation/gateways/market.gateway';

@Injectable()
export class MarketService implements OnModuleInit {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    @InjectModel(PriceSnapshot.name)
    private readonly snapshotModel: Model<PriceSnapshotDocument>,
    @Inject('MARKET_DATA_PROVIDER')
    private readonly provider: MarketDataProvider,
    private readonly cacheService: CacheService,
    private readonly marketGateway: MarketGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedInitialStocks();
  }

  async listQuotes()  {
    return await this.stockModel
    .find()
    .sort({ symbol: 1 })
    .lean()
    .exec();
    
  }

  async getQuote(symbol: string) {
    const stock = await this.stockModel
      .findOne({ symbol: symbol.toUpperCase() })
      .lean()
      .exec();

    if (!stock) {
      throw new NotFoundException('La acción solicitada no existe.');
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
    const stocks = await this.stockModel.find().exec();

    if (!stocks.length) {
      return [];
    }

    const snapshotsToInsert: { symbol: string; price: number }[] = [];
    const stockUpdateOperations: AnyBulkWriteOperation[] = [];

    for (const stock of stocks) {
      try {
        // Use provider.getQuote() for abstraction
        const quote = await this.provider.getQuote(stock.symbol);

        const dayChangePercentage = new Decimal(quote.price)
          .minus(stock.previousClose)
          .dividedBy(stock.previousClose)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber();

        stockUpdateOperations.push({
          updateOne: {
            filter: { _id: stock._id },
            update: {
              $set: {
                currentPrice: quote.price,
                dayChangePercentage: dayChangePercentage,
              },
            },
          },
        });

        snapshotsToInsert.push({
          symbol: quote.symbol,
          price: quote.price,
        });

        // Update cache in parallel (non-blocking for DB loop)
        void this.cacheService.set(`market:${stock.symbol}`, {
          symbol: quote.symbol,
          price: quote.price,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        // GRACEFUL: Log error but continue with next symbol
        this.logger.error(
          `Failed to update price for ${stock.symbol}: ${error.message}`,
          error.stack,
        );
      }
    }

    if (stockUpdateOperations.length) {
      await this.stockModel.bulkWrite(stockUpdateOperations);
    }

    if (snapshotsToInsert.length) {
      await this.snapshotModel.insertMany(snapshotsToInsert);
    }

    const quotes = await this.listQuotes();
    this.marketGateway.emitQuotes(quotes);

    return quotes;
  }

  private async seedInitialStocks(): Promise<void> {
    const count = await this.stockModel.estimatedDocumentCount();

    if (count > 0) {
      return;
    }

    const now = Date.now();
    const stocks = seedStocks.map((stock) => {
      const previousClose = new Decimal(stock.currentPrice)
        .times(0.985)
        .toDecimalPlaces(2)
        .toNumber();
      
      return {
        ...stock,
        previousClose,
        dayChangePercentage: 1.5,
      };
    });

    await this.stockModel.insertMany(stocks);

    const snapshots = stocks.flatMap((stock) =>
      Array.from({ length: 24 }, (_, index) => {
        const factor = new Decimal(1).plus(new Decimal(index - 12).times(0.0015));
        return {
          symbol: stock.symbol,
          price: new Decimal(stock.currentPrice).times(factor).toDecimalPlaces(2).toNumber(),
          createdAt: new Date(now - (24 - index) * 60 * 60 * 1000),
        };
      }),
    );

    await this.snapshotModel.insertMany(snapshots);
    this.logger.log('Mercado inicial sembrado con datos de ejemplo.');
  }
}
