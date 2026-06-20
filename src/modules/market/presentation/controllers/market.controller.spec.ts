import { MarketController } from './market.controller';

describe('MarketController', () => {
  it('informa estado y hora en la zona lógica del mercado', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T15:30:00.000Z'));
    const adminConfigService = {
      get: jest
        .fn()
        .mockResolvedValueOnce('09:30')
        .mockResolvedValueOnce('16:00'),
    };
    const controller = new MarketController(
      {} as never,
      adminConfigService as never,
    );

    await expect(controller.getStatus()).resolves.toMatchObject({
      open: true,
      currentTime: '11:30',
      timezone: 'America/Santiago',
    });

    jest.useRealTimers();
  });
});
