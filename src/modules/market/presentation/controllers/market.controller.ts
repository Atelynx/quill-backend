import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { MarketService } from '../../application/services/market.service';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import {
  getCurrentMinutes,
  isMarketOpen,
  formatTime,
} from '../../../../common/utils/market-hours';

@Controller('market')
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly adminConfigService: AdminConfigService,
  ) {}

  /**
   * EJEMPLO DE CACHE HIBRIDO:
   * 1. @UseInterceptors(CacheInterceptor) activa el cache para este endpoint.
   * 2. @CacheKey('market_quotes') define una clave personalizada (opcional, por defecto usa la URL).
   * 3. @CacheTTL(10000) define el tiempo de vida en milisegundos (10 seg).
   *
   * Esto usara Redis si esta disponible, o el Fallback en memoria si no.
   */
  @Get('status')
  async getStatus() {
    const [openTime, closeTime] = await Promise.all([
      this.adminConfigService.get('MARKET_HOURS_OPEN'),
      this.adminConfigService.get('MARKET_HOURS_CLOSED'),
    ]);

    const currentMinutes = getCurrentMinutes();
    const open = isMarketOpen(
      openTime as string,
      closeTime as string,
      currentMinutes,
    );

    return {
      open,
      openTime: openTime as string,
      closeTime: closeTime as string,
      currentTime: formatTime(new Date()),
    };
  }

  @UseInterceptors(CacheInterceptor)
  @CacheKey('market_quotes')
  @CacheTTL(10000)
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
