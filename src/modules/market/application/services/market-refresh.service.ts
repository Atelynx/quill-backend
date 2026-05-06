import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { MarketDataProvider } from '../../infrastructure/providers/market-data-provider.interface';
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
    private readonly snapshotService: MarketSnapshotService,
    private readonly updateWriter: MarketUpdateWriterService,
    private readonly marketGateway: MarketGateway,
  ) {}

  async refreshMarket(options: MarketRefreshOptions = {}) {
    const stocks = await this.stockModel.find().exec();
    const providerName = this.provider.getName().toLowerCase();

    if (!stocks.length) {
      this.logger.warn('Sin acciones en la base de datos. Verifique que MARKET_PROVIDER este configurado.');
      return [];
    }

    this.logger.log(
      `Iniciando refresh para ${stocks.length} acciones con provider "${providerName}" (allowExternalFetch: ${!!options.allowExternalFetch})`,
    );

    const updates =
      providerName === 'eodhd'
        ? await this.resolveEodhdUpdates(stocks)
        : await this.resolveProviderUpdates(stocks);

    const validUpdates = updates.filter(
      (update): update is NonNullable<typeof update> => update !== null,
    );

    this.logger.log(
      `Refresh completado: ${validUpdates.length}/${stocks.length} actualizaciones validas para persistir`,
    );

    await this.updateWriter.persist(validUpdates, providerName);
    const quotes = await this.stockModel.find().sort({ symbol: 1 }).lean().exec();
    this.marketGateway.emitQuotes(quotes);
    this.logger.log(`${quotes.length} cotizaciones emitidas por WebSocket`);
    return quotes;
  }

  private async resolveEodhdUpdates(
    stocks: StockDocument[],
  ): Promise<Array<MarketRefreshUpdate | null>> {
    const dailySnapshots = await this.snapshotService.getLatestMap(stocks, {
      from: this.today(),
      source: 'eodhd',
    });

    this.logger.log(
      `EODHD: ${dailySnapshots.size}/${stocks.length} con snapshot de hoy (source: eodhd)`,
    );

    return Promise.all(
      stocks.map(async (stock) => {
        const dailySnapshot = dailySnapshots.get(stock.symbol);

        if (dailySnapshot) {
          this.logger.debug(`EODHD: ${stock.symbol} tiene snapshot de hoy, usando cached`);
          return {
            stock,
            quote: this.snapshotService.quoteFromSnapshot(stock, dailySnapshot),
            save: false,
          };
        }

        return this.resolveMissingDailyQuote(stock);
      }),
    );
  }

  private async resolveProviderUpdates(stocks: StockDocument[]) {
    const updates: MarketRefreshUpdate[] = [];

    for (const stock of stocks) {
      try {
        this.logger.debug(`Provider: obteniendo cotizacion para ${stock.symbol}`);
        const quote = await this.provider.getQuote(stock.symbol);
        updates.push({ stock, quote, save: true });
        this.logger.log(
          `${stock.symbol} actualizado: $${quote.price} (source: ${quote.source})`,
        );
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
  ): Promise<MarketRefreshUpdate | null> {
    this.logger.log(`EODHD: ${stock.symbol} sin snapshot de hoy, intentando llamada a API...`);

    try {
      const quote = await this.provider.getQuote(stock.symbol);
      this.logger.log(
        `EODHD: ${stock.symbol} obtenido de API: $${quote.price} (source: ${quote.source})`,
      );
      return { stock, quote, save: true };
    } catch (error) {
      this.logger.error(
        `EODHD: fallo para ${stock.symbol}: ${this.errorMessage(error)}`,
      );
    }

    const fallbackSnapshots = await this.snapshotService.getLatestMap([stock]);
    const snapshot = fallbackSnapshots.get(stock.symbol);

    if (snapshot) {
      this.logger.log(
        `EODHD: ${stock.symbol} sin API, usando ultimo snapshot disponible: $${snapshot.price} (${snapshot.createdAt.toISOString()})`,
      );
      return {
        stock,
        quote: this.snapshotService.quoteFromSnapshot(stock, snapshot),
        save: false,
      };
    }

    this.logger.warn(
      `EODHD: ${stock.symbol} sin datos disponibles: sin snapshot de hoy, API fallo, y sin snapshot de respaldo. No se muestra data.`,
    );
    return null;
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
