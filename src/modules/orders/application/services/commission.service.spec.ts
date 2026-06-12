import { ConfigService } from '@nestjs/config';
import { CommissionService } from './commission.service';

describe('CommissionService', () => {
  const mockAdminConfig = { get: jest.fn().mockResolvedValue(null) };

  it('calcula la comision segun la tasa configurada', async () => {
    const configService = {
      get: jest.fn().mockReturnValue(0.005),
    } as unknown as ConfigService;

    const service = new CommissionService(
      configService,
      mockAdminConfig as never,
    );

    await expect(service.calculate(1000)).resolves.toBe(5);
    await expect(service.calculate(1520.45)).resolves.toBe(7.6);
  });

  it('redondea la comision financiera a dos decimales', async () => {
    const configService = {
      get: jest.fn().mockReturnValue(0.005),
    } as unknown as ConfigService;

    const service = new CommissionService(
      configService,
      mockAdminConfig as never,
    );

    await expect(service.calculate(33.333)).resolves.toBe(0.17);
    await expect(service.calculate(99.999)).resolves.toBe(0.5);
  });
});
