import type { MarketQuote } from '../../../market/domain/interfaces/market-quote.interface';

export interface ProviderRefreshSchedule {
  cronExpression: string;
}

export interface CurrencyDataProvider {
  getQuote(symbol: string): Promise<MarketQuote>;

  getName(): string;

  getSymbols(): string[];

  getRefreshSchedule?(): ProviderRefreshSchedule | undefined;
}
