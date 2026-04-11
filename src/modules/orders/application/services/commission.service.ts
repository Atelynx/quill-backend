import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';

@Injectable()
export class CommissionService {
  constructor(private readonly configService: ConfigService) {}

  calculate(baseAmount: number): number {
    const rate = this.configService.get<number>('COMMISSION_RATE', 0.005);
    return new Decimal(baseAmount).times(rate).toDecimalPlaces(2).toNumber();
  }
}
