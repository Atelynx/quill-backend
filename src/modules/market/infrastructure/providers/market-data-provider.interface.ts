import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';

/**
 * Abstract contract for market data providers.
 * All providers (Mock, MarketStack, Finnhub, etc.) must implement this.
 */
export interface MarketDataProvider {
  getQuote(symbol: string): Promise<MarketQuote>;

  getQuotes?(symbols: string[]): Promise<MarketQuote[]>;

  getName(): string;

  validateSymbol?(symbol: string): Promise<boolean>;

  generateNextPrice?(stock: any): number;
}
