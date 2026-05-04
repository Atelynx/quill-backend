/**
 * Unified quote model across all market data providers.
 * Normalizes different API response formats into a single contract.
 */
export interface MarketQuote {
  symbol: string;
  price: number;
  currency: string;
  timestamp: Date;
  exchange: string;
  source?: string;
  name?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  dayChangePercentage?: number;
  bid?: number;
  ask?: number;
}
