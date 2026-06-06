import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CurrencyRateService } from '../../application/services/currency-rate.service';

@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyRateService: CurrencyRateService) {}

  @Get('rates')
  async getRates() {
    return this.currencyRateService.getRates();
  }

  @Get('rates/:symbol')
  async getRate(@Param('symbol') symbol: string) {
    const rate = await this.currencyRateService.getRate(symbol);
    if (!rate) {
      throw new NotFoundException(
        `Rate for ${symbol.toUpperCase()} not available`,
      );
    }
    return rate;
  }
}
