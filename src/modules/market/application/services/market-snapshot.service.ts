import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import Decimal from 'decimal.js';
import { Model } from 'mongoose';
import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../infrastructure/schemas/price-snapshot.schema';
import { StockDocument } from '../../infrastructure/schemas/stock.schema';

interface SnapshotFilter {
  from?: Date;
  source?: string;
}

@Injectable()
export class MarketSnapshotService {
  constructor(
    @InjectModel(PriceSnapshot.name)
    private readonly snapshotModel: Model<PriceSnapshotDocument>,
  ) {}

  async getLatestMap(stocks: StockDocument[], filter: SnapshotFilter = {}) {
    const snapshots = await this.snapshotModel
      .find(this.buildFilter(stocks, filter))
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const bySymbol = new Map<string, PriceSnapshotDocument>();

    snapshots.forEach((snapshot) => {
      if (!bySymbol.has(snapshot.symbol)) {
        bySymbol.set(snapshot.symbol, snapshot as PriceSnapshotDocument);
      }
    });

    return bySymbol;
  }

  quoteFromSnapshot(
    stock: StockDocument,
    snapshot: PriceSnapshotDocument,
  ): MarketQuote {
    return {
      symbol: stock.symbol,
      name: stock.name,
      price: snapshot.price,
      currency: stock.currency,
      timestamp: snapshot.createdAt,
      exchange: 'SNAPSHOT',
      source: snapshot.source ?? 'snapshot',
      previousClose: stock.previousClose,
      dayChangePercentage: this.percent(snapshot.price, stock.previousClose),
    };
  }

  private buildFilter(stocks: StockDocument[], filter: SnapshotFilter) {
    return {
      symbol: { $in: stocks.map((stock) => stock.symbol) },
      ...(filter.from ? { createdAt: { $gte: filter.from } } : {}),
      ...(filter.source ? { source: filter.source } : {}),
    };
  }

  private percent(price: number, previousClose: number): number {
    return new Decimal(price)
      .minus(previousClose)
      .dividedBy(previousClose)
      .times(100)
      .toDecimalPlaces(2)
      .toNumber();
  }
}
