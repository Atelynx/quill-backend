import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketService } from '../../application/services/market.service';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('stocks')
  getStocks() {
    return this.marketService.listQuotes();
  }

  @Get('stocks/:symbol/history')
  getHistory(@Param('symbol') symbol: string, @Query('limit') limit?: string) {
    return this.marketService.getPriceHistory(symbol, Number(limit ?? 24));
  }

  @Get('top-movers')
  getTopMovers() {
    return this.marketService.getTopMovers();
  }
}
