import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import Decimal from 'decimal.js';
import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';
import {
  Stock,
  StockDocument,
} from '../../infrastructure/schemas/stock.schema';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../infrastructure/schemas/price-snapshot.schema';
import {
  EodhdQuoteResponse,
  normalizeEodhdQuote,
} from './eodhd-quote.mapper';
import { MarketDataProvider, StockSeed } from './market-data-provider.interface';

@Injectable()
export class EodhdMarketDataProvider implements MarketDataProvider {
  private readonly logger = new Logger(EodhdMarketDataProvider.name);
  private readonly baseUrl: string;
  private readonly exchangeCode: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    @InjectModel(PriceSnapshot.name)
    private readonly snapshotModel: Model<PriceSnapshotDocument>,
  ) {
    this.baseUrl = this.configService
      .get<string>('EODHD_BASE_URL', 'https://eodhd.com/api')
      .replace(/\/+$/, '');
    this.exchangeCode = this.configService.get<string>('EODHD_EXCHANGE_CODE', 'SN');
  }

  /**
   * Fetch a quote for the given symbol.
   * Checks today's snapshot cache first. If no cached data exists,
   * calls the EODHD API and persists the result as a snapshot.
   */
  async getQuote(symbol: string): Promise<MarketQuote> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check if we already have a snapshot from today to avoid wasting API calls
    const cachedQuote = await this.getTodaySnapshot(normalizedSymbol);
    if (cachedQuote) {
      this.logger.debug(`${normalizedSymbol} using cached snapshot from today`);
      return cachedQuote;
    }

    this.logger.log(`Fetching ${normalizedSymbol} from EODHD API`);
    try {
      const apiQuote = await this.fetchFromApi(normalizedSymbol);
      await this.persistSnapshot(normalizedSymbol, apiQuote.price);
      return apiQuote;
    } catch (error) {
      throw new Error(
        `EODHD no pudo obtener ${normalizedSymbol}: ${this.describeError(error)}`,
      );
    }
  }

  /**
   * Fetch quotes for multiple symbols sequentially.
   * Each symbol goes through the cache-then-API flow independently.
   */
  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const quotes: MarketQuote[] = [];

    for (const symbol of symbols) {
      try {
        quotes.push(await this.getQuote(symbol));
      } catch (error) {
        this.logger.warn(
          `Could not fetch ${symbol} from EODHD: ${this.describeError(error)}`,
        );
      }
    }

    return quotes;
  }

  getName(): string {
    return 'EODHD';
  }

  /**
   * Declare the daily refresh schedule for EODHD.
   * Default: 6:30 PM Monday-Friday (after market close for Chilean stocks).
   */
  /**
   * Declare the daily refresh schedule for EODHD.
   * Default: 6:30 PM Monday-Friday (after market close for Chilean stocks).
   */
  getRefreshSchedule() {
    const cronExpression = this.configService.get<string>(
      'EODHD_DAILY_REFRESH_CRON',
      '0 30 18 * * 1-5',
    );
    return { cronExpression };
  }

  /**
   * Return seed data from the EODHD_SYMBOLS env var.
   * Creates placeholder records with zero prices until the first API fetch.
   */
  getSeedData(): StockSeed[] {
    const symbols = this.configService
      .get<string>('EODHD_SYMBOLS', '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (!symbols.length) {
      return [];
    }

    return symbols.map((symbol) => ({
      symbol,
      name: symbol,
      currency: 'CLP',
      close: 0,
      previousClose: 0,
      source: 'eodhd',
    }));
  }

  /**
   * Fetch a quote directly from the EODHD API.
   */
  private async fetchFromApi(symbol: string): Promise<MarketQuote> {
    const url = `${this.baseUrl}/real-time/${encodeURIComponent(symbol)}`;
    const apiToken = this.configService.getOrThrow<string>('EODHD_API_KEY');

    const response = await axios.get<EodhdQuoteResponse>(url, {
      params: { api_token: apiToken, fmt: 'json' },
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });

    return normalizeEodhdQuote(response.data, symbol, this.exchangeCode);
  }

  /**
   * Check if a snapshot exists for today. Returns a MarketQuote if found.
   */
  private async getTodaySnapshot(symbol: string): Promise<MarketQuote | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await this.snapshotModel
      .findOne({
        symbol,
        createdAt: { $gte: today },
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!snapshot) return null;

    // Reconstruct a MarketQuote from the snapshot
    const stock = await this.stockModel
      .findOne({ symbol })
      .lean()
      .exec();

    if (!stock) return null;

    const previousClose = stock.previousClose ?? 0;
    const dayChangePercentage = previousClose > 0
      ? new Decimal(snapshot.price)
          .minus(previousClose)
          .dividedBy(previousClose)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber()
      : 0;

    return {
      symbol: stock.symbol,
      name: stock.name,
      price: snapshot.price,
      currency: stock.currency,
      timestamp: snapshot.createdAt,
      exchange: 'EODHD',
      source: snapshot.source ?? 'eodhd',
      previousClose,
      dayChangePercentage,
    };
  }

  /**
   * Persist a price snapshot for cache purposes.
   */
  private async persistSnapshot(symbol: string, price: number): Promise<void> {
    await this.snapshotModel.create({
      symbol,
      price,
      source: 'eodhd',
    });
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
