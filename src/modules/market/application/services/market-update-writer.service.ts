import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import Decimal from 'decimal.js';
import { AnyBulkWriteOperation, Model } from 'mongoose';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../infrastructure/schemas/price-snapshot.schema';
import {
  Stock,
  StockDocument,
} from '../../infrastructure/schemas/stock.schema';
import { CacheService } from '../../../system/application/services/cache/cache.service';
import type { MarketRefreshUpdate } from './market-refresh.types';

@Injectable()
export class MarketUpdateWriterService {
  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    @InjectModel(PriceSnapshot.name)
    private readonly snapshotModel: Model<PriceSnapshotDocument>,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async persist(updates: MarketRefreshUpdate[], providerName: string) {
    const stockOperations: AnyBulkWriteOperation[] = [];
    const snapshots: Array<{ symbol: string; price: number; source: string }> =
      [];

    for (const update of updates) {
      stockOperations.push(this.buildStockOperation(update, providerName));

      if (update.save) {
        snapshots.push({
          symbol: update.quote.symbol,
          price: update.quote.price,
          source: update.quote.source ?? providerName,
        });
      }

      this.cacheQuote(update);
    }

    if (stockOperations.length) {
      await this.stockModel.bulkWrite(stockOperations);
    }

    if (snapshots.length) {
      await this.snapshotModel.insertMany(snapshots);
    }
  }

  private buildStockOperation(
    update: MarketRefreshUpdate,
    providerName: string,
  ) {
    const previousClose =
      update.quote.previousClose ?? update.stock.previousClose;
    const dayChangePercentage =
      update.quote.dayChangePercentage ??
      this.percent(update.quote.price, previousClose);

    return {
      updateOne: {
        filter: { _id: update.stock._id },
        update: {
          $set: {
            name: update.quote.name ?? update.stock.name,
            close: update.quote.close,
            open: update.quote.open ?? update.stock.open,
            high: update.quote.high ?? update.stock.high,
            low: update.quote.low ?? update.stock.low,
            previousClose,
            dayChangePercentage,
            source: update.quote.source ?? providerName,
            volume: update.quote.volume,
            lastMarketDate: update.quote.timestamp,
          },
        },
      },
    };
  }

  private cacheQuote(update: MarketRefreshUpdate): void {
    const symbol = update.stock.symbol;
    const price = update.quote.price;
    void this.cacheService.set(
      `market:${symbol}`,
      {
        symbol,
        price,
        updatedAt: new Date().toISOString(),
      },
      this.cacheTtlMs(),
    );
    void this.cacheService.set(
      `stock:${symbol}:base_price`,
      price,
      this.cacheTtlMs(),
    );
    void this.cacheService.set(
      `stock:${symbol}:live_price`,
      price,
      this.cacheTtlMs(),
    );
  }

  private percent(price: number, previousClose: number): number {
    return new Decimal(price)
      .minus(previousClose)
      .dividedBy(previousClose)
      .times(100)
      .toDecimalPlaces(2)
      .toNumber();
  }

  private cacheTtlMs(): number {
    return (
      this.configService.get<number>('EODHD_CACHE_TTL_SECONDS', 86400) * 1000
    );
  }
}
