import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';
import { MarketDataProvider } from './market-data-provider.interface';

export class NoneMarketDataProvider implements MarketDataProvider {
  getName(): string {
    return 'none';
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    throw new Error(
      `No hay datos configurados para ${symbol}. Establezca MARKET_PROVIDER=mock o MARKET_PROVIDER=eodhd en el archivo .env`,
    );
  }
}
