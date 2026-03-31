import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CommissionService {
  constructor(private readonly configService: ConfigService) {}

  calculate(baseAmount: number): number {
    const rate = this.configService.get<number>('COMMISSION_RATE', 0.005);
    return Number((baseAmount * rate).toFixed(2));
  }
}
