import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Decimal from 'decimal.js';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';

@Injectable()
export class CommissionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly adminConfigService: AdminConfigService,
  ) {}

  async calculate(baseAmount: number): Promise<number> {
    const adminRate = await this.adminConfigService.get('COMMISSION_RATE');
    const rate =
      adminRate ?? this.configService.get<number>('COMMISSION_RATE', 0.005);
    return new Decimal(baseAmount).times(rate).toDecimalPlaces(2).toNumber();
  }
}
