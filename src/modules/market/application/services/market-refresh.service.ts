import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PRICE_UPDATE_EVENT } from '../../domain/constants/events';
import type { MarketDataProvider } from '../../infrastructure/providers/market-data-provider.interface';
import {
  Stock,
  StockDocument,
} from '../../infrastructure/schemas/stock.schema';
import { MarketUpdateWriterService } from './market-update-writer.service';

/**
 * Orchestrates periodic market data refreshes.
 * Provider-agnostic: delegates all fetching logic to the active MarketDataProvider.
 * Each provider handles its own caching, API calls, and fallback strategies internally.
 */
@Injectable()
export class MarketRefreshService {
  private readonly logger = new Logger(MarketRefreshService.name);
  private isRefreshing = false;

  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    @Inject('MARKET_DATA_PROVIDER')
    private readonly provider: MarketDataProvider,
    private readonly updateWriter: MarketUpdateWriterService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Refreshes all tracked stocks by calling the active provider.
   * Uses a concurrency lock to prevent overlapping refresh cycles.
   * Returns the latest stock quotes after persistence.
   */
  async refreshMarket() {
    // Prevent overlapping refresh cycles that would waste API quota
    if (this.isRefreshing) {
      this.logger.warn('Refresh already in progress, skipping.');
      return [];
    }

    this.isRefreshing = true;
    try {
      const stocks = await this.stockModel.find().exec();
      const providerName = this.provider.getName().toLowerCase();

      if (!stocks.length) {
        this.logger.warn(
          'No stocks in database. Verify MARKET_PROVIDER is configured.',
        );
        return [];
      }

      this.logger.log(
        `Starting refresh for ${stocks.length} stocks with provider "${providerName}"`,
      );

      // Delegate fetching to the provider — each provider handles its own caching/API strategy
      const symbols = stocks.map((stock) => stock.symbol);
      const quotes = await this.fetchQuotes(this.provider, symbols, stocks);

      // Build updates for persistence
      const updates = quotes
        .map((quote) => {
          const matchingStock = stocks.find((s) => s.symbol === quote.symbol);
          return matchingStock
            ? { stock: matchingStock, quote, save: true }
            : null;
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      this.logger.log(
        `Refresh completed: ${updates.length}/${stocks.length} valid updates to persist`,
      );

      await this.updateWriter.persist(updates, providerName);
      const refreshedQuotes = await this.stockModel
        .find()
        .sort({ symbol: 1 })
        .lean()
        .exec();
      this.eventEmitter.emit(PRICE_UPDATE_EVENT, refreshedQuotes);
      this.logger.log(`${refreshedQuotes.length} quotes emitted via event bus`);
      return refreshedQuotes;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Fetches quotes using the provider's getQuotes method if available,
   * otherwise falls back to calling getQuote() per symbol.
   */
  private async fetchQuotes(
    provider: MarketDataProvider,
    symbols: string[],
    stocks: StockDocument[],
  ) {
    if (provider.getQuotes) {
      return provider.getQuotes(symbols);
    }

    // Fallback for providers that only implement getQuote()
    const results: Array<{
      symbol: string;
      price: number;
      close?: number;
      currency: string;
      timestamp: Date;
      exchange: string;
      source?: string;
      name?: string;
      previousClose?: number;
      dayChangePercentage?: number;
      volume?: number;
    }> = [];
    for (const symbol of symbols) {
      try {
        const quote = await provider.getQuote(symbol);
        results.push(quote);
        this.logger.log(
          `${symbol} updated: $${quote.price} (source: ${quote.source})`,
        );
      } catch (error) {
        this.logger.error(
          `Could not update ${symbol}: ${this.errorMessage(error)}`,
        );
      }
    }
    return results;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
