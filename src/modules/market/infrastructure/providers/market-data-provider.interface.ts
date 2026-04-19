import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';

/**
 * Abstract contract for market data providers.
 * All providers (Mock, MarketStack, Finnhub, etc.) must implement this.
 */
export interface MarketDataProvider {
  /**
   * Get current quote for a symbol.
   * @param symbol - Stock ticker symbol (e.g., 'COPEC', 'AAPL')
   * @returns Promise resolving to normalized MarketQuote
   * @throws Error if symbol not found or API call fails
   */
  getQuote(symbol: string): Promise<MarketQuote>;

  /**
   * Get provider name for logging and debugging.
   */
  getName(): string;

  /**
   * Optional: Validate if symbol exists before fetching quote.
   * Used during startup to verify symbol availability.
   */
  validateSymbol?(symbol: string): Promise<boolean>;

  /**
   * Optional: Generate next price for simulation/testing.
   * Only implemented by MockProvider.
   */
  generateNextPrice?(stock: any): number;
}
