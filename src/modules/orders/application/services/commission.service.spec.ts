import { ConfigService } from '@nestjs/config';
import { CommissionService } from './commission.service';

describe('CommissionService', () => {
  it('calcula la comision segun la tasa configurada', () => {
    const configService = {
      get: jest.fn().mockReturnValue(0.005),
    } as unknown as ConfigService;

    const service = new CommissionService(configService);

    expect(service.calculate(1000)).toBe(5);
    expect(service.calculate(1520.45)).toBe(7.6);
  });
});
