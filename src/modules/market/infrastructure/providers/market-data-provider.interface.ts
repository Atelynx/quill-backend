import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';

/**
 * Optional scheduling configuration that a provider can declare.
 * If implemented, the generic scheduler will register a cron job
 * at the specified expression.
 */
export interface ProviderRefreshSchedule {
  cronExpression: string;
}

/**
 * Seed data used when initializing stocks for a provider.
 */
export interface StockSeed {
  symbol: string;
  name: string;
  sector: string;
  currency: string;
  currentPrice: number;
  previousClose?: number;
  dayChangePercentage?: number;
  source?: string;
}

/**
 * Abstract contract for market data providers.
 * All providers (Mock, EODHD, Finnhub, etc.) must implement the
 * required methods. Optional methods let providers declare their
 * own scheduling, seeding, and caching behavior.
 */
export interface MarketDataProvider {
  /**
   * Fetch a single quote for the given symbol.
   * Providers handle their own caching, API calls, and fallbacks internally.
   */
  getQuote(symbol: string): Promise<MarketQuote>;

  /**
   * Fetch quotes for multiple symbols.
   * Default implementation in the base class calls getQuote() per symbol.
   */
  getQuotes?(symbols: string[]): Promise<MarketQuote[]>;

  /**
   * Human-readable provider name for logging and source tracking.
   */
  getName(): string;

  /**
   * Optional: validate whether a symbol exists in the provider's universe.
   */
  validateSymbol?(symbol: string): Promise<boolean>;

  /**
   * Optional: declare a refresh schedule for the generic scheduler.
   * Returns undefined if the provider does not need scheduled refreshes
   * (e.g., Mock generates live prices on demand).
   */
  getRefreshSchedule?(): ProviderRefreshSchedule | undefined;

  /**
   * Optional: return seed data for initial stock setup.
   * Returns undefined if the provider does not contribute seed data.
   */
  getSeedData?(): StockSeed[];
}
