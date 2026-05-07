import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { MarketDataProvider } from '../../infrastructure/providers/market-data-provider.interface';
import { MockMarketDataProvider } from '../../infrastructure/providers/mock-market-data.provider';
import { Stock, StockDocument } from '../../infrastructure/schemas/stock.schema';
import { MarketGateway } from '../../presentation/gateways/market.gateway';
import { MarketRefreshOptions, MarketRefreshUpdate } from './market-refresh.types';
import { MarketSnapshotService } from './market-snapshot.service';
import { MarketUpdateWriterService } from './market-update-writer.service';

@Injectable()
export class MarketRefreshService {
  private readonly logger = new Logger(MarketRefreshService.name);

  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    @Inject('MARKET_DATA_PROVIDER') private readonly provider: MarketDataProvider,
    private readonly mockProvider: MockMarketDataProvider,
    private readonly snapshotService: MarketSnapshotService,
    private readonly updateWriter: MarketUpdateWriterService,
    private readonly marketGateway: MarketGateway,
  ) {}

  async refreshMarket(options: MarketRefreshOptions = {}) {
    const stocks = await this.stockModel.find().exec();

    if (!stocks.length) {
      return [];
    }

    const providerName = this.provider.getName().toLowerCase();
    const updates =
      providerName === 'eodhd'
        ? await this.resolveEodhdUpdates(stocks, !!options.allowExternalFetch)
        : await this.resolveProviderUpdates(stocks);

    await this.updateWriter.persist(updates, providerName);
    const quotes = await this.stockModel.find().sort({ symbol: 1 }).lean().exec();
    this.marketGateway.emitQuotes(quotes);
    return quotes;
  }

  private async resolveEodhdUpdates(
    stocks: StockDocument[],
    allowExternalFetch: boolean,
  ): Promise<MarketRefreshUpdate[]> {
    const dailySnapshots = await this.snapshotService.getLatestMap(stocks, {
      from: this.today(),
      source: 'eodhd',
    });
    const fallbackSnapshots = await this.snapshotService.getLatestMap(stocks);

    return Promise.all(
      stocks.map(async (stock) => {
        const dailySnapshot = dailySnapshots.get(stock.symbol);

        if (dailySnapshot) {
          return {
            stock,
            quote: this.snapshotService.quoteFromSnapshot(stock, dailySnapshot),
            save: false,
          };
        }

        return this.resolveMissingDailyQuote(
          stock,
          fallbackSnapshots,
          allowExternalFetch,
        );
      }),
    );
  }

  private async resolveProviderUpdates(stocks: StockDocument[]) {
    const updates: MarketRefreshUpdate[] = [];

    for (const stock of stocks) {
      try {
        updates.push({
          stock,
          quote: await this.provider.getQuote(stock.symbol),
          save: true,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo actualizar ${stock.symbol}: ${this.errorMessage(error)}`,
        );
      }
    }

    return updates;
  }

  private async resolveMissingDailyQuote(
    stock: StockDocument,
    fallbackSnapshots: Awaited<ReturnType<MarketSnapshotService['getLatestMap']>>,
    allowExternalFetch: boolean,
  ): Promise<MarketRefreshUpdate> {
    if (allowExternalFetch) {
      try {
        return { stock, quote: await this.provider.getQuote(stock.symbol), save: true };
      } catch (error) {
        this.logger.error(`EODHD fallo para ${stock.symbol}: ${this.errorMessage(error)}`);
      }
    }

    const snapshot = fallbackSnapshots.get(stock.symbol);

    if (snapshot) {
      return {
        stock,
        quote: this.snapshotService.quoteFromSnapshot(stock, snapshot),
        save: false,
      };
    }

    return { stock, quote: await this.mockProvider.getQuote(stock.symbol), save: true };
  }

  private today(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'error desconocido';
  }
}
