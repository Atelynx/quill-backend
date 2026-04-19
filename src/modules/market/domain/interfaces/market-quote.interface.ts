/**
 * Unified quote model across all market data providers.
 * Normalizes different API response formats into a single contract.
 */
export interface MarketQuote {
  // Essential fields (required by all providers)
  symbol: string;
  price: number;
  currency: string;
  timestamp: Date;
  exchange: string;

  // Optional enrichment fields
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  dayChangePercentage?: number;
  bid?: number;
  ask?: number;
}
