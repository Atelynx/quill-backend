import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';
import type { StockDocument } from '../../infrastructure/schemas/stock.schema';

export interface MarketRefreshOptions {
  allowExternalFetch?: boolean;
}

export interface MarketRefreshUpdate {
  stock: StockDocument;
  quote: MarketQuote;
  save: boolean;
}
