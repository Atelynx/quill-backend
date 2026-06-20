import { MarketController } from './market.controller';

describe('MarketController', () => {
  it('informa estado, hora y días cerrados del mercado', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T15:30:00.000Z'));
    const adminConfigService = {
      get: jest
        .fn()
        .mockResolvedValueOnce('09:30')
        .mockResolvedValueOnce('16:00')
        .mockResolvedValueOnce('6,7'),
    };
    const controller = new MarketController(
      {} as never,
      adminConfigService as never,
    );

    await expect(controller.getStatus()).resolves.toMatchObject({
      open: true,
      closedDays: [6, 7],
      currentTime: '11:30',
      timezone: 'America/Santiago',
    });

    jest.useRealTimers();
  });
});
