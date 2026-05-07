import { Injectable } from '@nestjs/common';
import type { StockDocument } from '../schemas/stock.schema';
import { MarketQuote } from '../../domain/interfaces/market-quote.interface';
import { seedStocks } from '../../domain/constants/seed-stocks';
import { MarketDataProvider, StockSeed } from './market-data-provider.interface';

/**
 * Mock market data provider that generates realistic price movements
 * using a momentum-based algorithm. No external API calls are made.
 */
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

    // Initialize mock stock data on first request
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
      currentPrice: stock.price,
    } as Pick<StockDocument, 'symbol' | 'currentPrice'>);

    // Update internal price
    stock.price = nextPrice;

    // Calculate day change
    const dayChangePercentage =
      ((nextPrice - stock.previousClose) / stock.previousClose) * 100;

    return {
      symbol: upperSymbol,
      price: nextPrice,
      currency: 'USD',
      timestamp: new Date(),
      exchange: 'MOCK',
      previousClose: stock.previousClose,
      dayChangePercentage,
    };
  }

  getName(): string {
    return 'Mock';
  }

  /**
   * Return seed data for initial stock setup.
   * Uses the predefined Chilean/US stock list with realistic prices.
   */
  getSeedData(): StockSeed[] {
    const basePrice = 0.985; // 1.5% below current price for previousClose

    return seedStocks.map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      currency: stock.currency,
      currentPrice: stock.currentPrice,
      previousClose: Number(
        (stock.currentPrice * basePrice).toFixed(2),
      ),
      dayChangePercentage: 1.5,
      source: 'mock',
    }));
  }

  /**
   * Generate next price with momentum algorithm.
   * Internal helper kept for backward compatibility.
   */
  generateNextPrice(
    stock: Pick<StockDocument, 'symbol' | 'currentPrice'>,
  ): number {
    const previousMomentum = this.momentumBySymbol.get(stock.symbol) ?? 0;
    const noise = (Math.random() - 0.5) * 0.006;
    const wave =
      Math.sin(Date.now() / 45000 + stock.currentPrice / 120) * 0.0016;

    const nextMomentum = Math.max(
      Math.min(previousMomentum * 0.62 + noise + wave, 0.009),
      -0.009,
    );

    this.momentumBySymbol.set(stock.symbol, nextMomentum);

    const nextPrice = stock.currentPrice * (1 + nextMomentum);

    return Number(Math.max(nextPrice, 5).toFixed(2));
  }
}
