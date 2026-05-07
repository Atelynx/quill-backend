import { Injectable } from '@nestjs/common';
import type { StockDocument } from '../schemas/stock.schema';
import { MarketDataProvider } from './market-data-provider.interface';
import { MarketQuote } from '../../domain/interfaces/market-quote.interface';

@Injectable()
export class MockMarketDataProvider implements MarketDataProvider {
  private readonly momentumBySymbol = new Map<string, number>();
  private readonly mockStocks = new Map<
    string,
    { price: number; previousClose: number }
  >();

  /**
   * Get quote for a symbol using mock price generation.
   * Creates realistic price movements with momentum algorithm.
   */
  async getQuote(symbol: string): Promise<MarketQuote> {
    const upperSymbol = symbol.toUpperCase();

    // Get or initialize mock stock data
    if (!this.mockStocks.has(upperSymbol)) {
      this.mockStocks.set(upperSymbol, {
        price: 100,
        previousClose: 100,
      });
    }

    const stock = this.mockStocks.get(upperSymbol)!;

    // Generate next price using momentum algorithm
    const nextPrice = this.generateNextPrice({
      symbol: upperSymbol,
      close: stock.price,
    } as Pick<StockDocument, 'symbol' | 'close'>);

    // Update internal price
    stock.price = nextPrice;

    // Calculate day change
    const dayChangePercentage =
      ((nextPrice - stock.previousClose) / stock.previousClose) * 100;

    return {
      symbol: upperSymbol,
      price: nextPrice,
      currency: 'USD', // Mock uses USD
      timestamp: new Date(),
      exchange: 'MOCK',
      previousClose: stock.previousClose,
      dayChangePercentage,
    };
  }

  /**
   * Return provider name for logging.
   */
  getName(): string {
    return 'Mock';
  }

  /**
   * Generate next price with momentum algorithm.
   * This is the original logic, kept for backward compatibility.
   */
  generateNextPrice(
    stock: Pick<StockDocument, 'symbol' | 'close'>,
  ): number {
    const previousMomentum = this.momentumBySymbol.get(stock.symbol) ?? 0;
    const noise = (Math.random() - 0.5) * 0.006;
    const wave = Math.sin(Date.now() / 45000 + stock.close / 120) * 0.0016;

    const nextMomentum = Math.max(
      Math.min(previousMomentum * 0.62 + noise + wave, 0.009),
      -0.009,
    );

    this.momentumBySymbol.set(stock.symbol, nextMomentum);

    const nextPrice = stock.close * (1 + nextMomentum);

    return Number(Math.max(nextPrice, 5).toFixed(2));
  }
}
