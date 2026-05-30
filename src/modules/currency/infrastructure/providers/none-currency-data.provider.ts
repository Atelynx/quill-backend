import type { MarketQuote } from '../../../market/domain/interfaces/market-quote.interface';
import { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';

export class NoneCurrencyDataProvider implements CurrencyDataProvider {
  getName(): string {
    return 'none';
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    throw new Error(
      `No currency provider configured for ${symbol}. Set CURRENCY_PROVIDER=mock or CURRENCY_PROVIDER=external in .env`,
    );
  }
}
