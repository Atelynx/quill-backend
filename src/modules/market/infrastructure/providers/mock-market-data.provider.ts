import { Injectable } from '@nestjs/common';
import type { StockDocument } from '../schemas/stock.schema';

@Injectable()
export class MockMarketDataProvider {
  private readonly momentumBySymbol = new Map<string, number>();

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
