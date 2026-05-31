import { SchedulerRegistry } from '@nestjs/schedule';
import { CurrencyAnchorService } from './currency-anchor.service';

jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));
import { Logger } from '@nestjs/common';

describe('CurrencyAnchorService', () => {
  let service: CurrencyAnchorService;
  let provider: {
    getSymbols: jest.Mock;
    getName: jest.Mock;
    getQuote: jest.Mock;
    getRefreshSchedule: jest.Mock;
  };
  let cacheService: { get: jest.Mock; set: jest.Mock };
  let schedulerRegistry: {
    addCronJob: jest.Mock;
    deleteCronJob: jest.Mock;
    doesExist: jest.Mock;
  };

  beforeEach(() => {
    provider = {
      getSymbols: jest.fn(),
      getName: jest.fn().mockReturnValue('TestProvider'),
      getQuote: jest.fn(),
      getRefreshSchedule: jest.fn(),
    };
    cacheService = { get: jest.fn(), set: jest.fn() };
    schedulerRegistry = {
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
    };
    service = new CurrencyAnchorService(
      provider as never,
      cacheService as never,
      schedulerRegistry as unknown as SchedulerRegistry,
    );
  });
  beforeAll(()=>{
    Logger.overrideLogger(false);
  })

  describe('onModuleInit', () => {
    it('warns and returns when provider has no symbols', async () => {
      provider.getSymbols.mockReturnValue([]);
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      await service.onModuleInit();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('has no symbols'),
      );
      expect(provider.getQuote).not.toHaveBeenCalled();
    });

    it('fetches anchors and registers cron when schedule exists', async () => {
      provider.getSymbols.mockReturnValue(['EURUSD', 'GBPUSD']);
      provider.getRefreshSchedule.mockReturnValue({ cronExpression: '0 */5 * * *' });
      provider.getQuote
        .mockResolvedValueOnce({ close: 1.1 })
        .mockResolvedValueOnce({ close: 1.3 });
      cacheService.get.mockResolvedValue(null);

      await service.onModuleInit();

      expect(provider.getQuote).toHaveBeenCalledTimes(2);
      expect(cacheService.set).toHaveBeenCalledTimes(4);
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        'currency-anchor',
        expect.any(Object),
      );
    });

    it('does not register cron when provider has no refresh schedule', async () => {
      provider.getSymbols.mockReturnValue(['EURUSD']);
      provider.getRefreshSchedule.mockReturnValue(undefined);
      provider.getQuote.mockResolvedValue({ close: 1.1 });
      cacheService.get.mockResolvedValue(null);

      await service.onModuleInit();

      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('deletes the cron job if it exists', () => {
      schedulerRegistry.doesExist.mockReturnValue(true);
      service.onModuleDestroy();
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith('currency-anchor');
    });

    it('does nothing if cron job does not exist', () => {
      schedulerRegistry.doesExist.mockReturnValue(false);
      service.onModuleDestroy();
      expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalled();
    });
  });

  describe('fetchAndStoreAnchors', () => {
    it('sets base price and live price if live is null', async () => {
      provider.getSymbols.mockReturnValue(['EURUSD']);
      provider.getQuote.mockResolvedValue({ close: 1.1 });
      cacheService.get.mockResolvedValue(null);

      await (service as any).fetchAndStoreAnchors(['EURUSD']);

      expect(cacheService.set).toHaveBeenCalledWith('forex:EURUSD:base_price', 1.1);
      expect(cacheService.set).toHaveBeenCalledWith('forex:EURUSD:live_price', 1.1);
    });

    it('does not overwrite existing live price', async () => {
      provider.getSymbols.mockReturnValue(['EURUSD']);
      provider.getQuote.mockResolvedValue({ close: 1.15 });
      cacheService.get.mockResolvedValue(1.12);

      await (service as any).fetchAndStoreAnchors(['EURUSD']);

      expect(cacheService.set).toHaveBeenCalledWith('forex:EURUSD:base_price', 1.15);
      expect(cacheService.set).not.toHaveBeenCalledWith('forex:EURUSD:live_price', 1.15);
    });

    it('handles per-symbol errors without failing the batch', async () => {
      provider.getQuote
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ close: 1.3 });
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await (service as any).fetchAndStoreAnchors(['EURUSD', 'GBPUSD']);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('EURUSD'));
      expect(cacheService.set).toHaveBeenCalledTimes(2);
    });

    it('uses quote.price when quote.close is undefined', async () => {
      provider.getQuote.mockResolvedValue({ price: 200 });

      await (service as any).fetchAndStoreAnchors(['USDCLP']);

      expect(cacheService.set).toHaveBeenCalledWith('forex:USDCLP:base_price', 200);
    });
  });

  describe('handleAnchorCron', () => {
    it('fetches anchors for all symbols', async () => {
      provider.getSymbols.mockReturnValue(['EURUSD']);
      provider.getQuote.mockResolvedValue({ close: 1.1 });
      cacheService.get.mockResolvedValue(null);

      await (service as any).handleAnchorCron();

      expect(provider.getQuote).toHaveBeenCalledWith('EURUSD');
    });

    it('returns early when no symbols', async () => {
      provider.getSymbols.mockReturnValue([]);
      await (service as any).handleAnchorCron();
      expect(provider.getQuote).not.toHaveBeenCalled();
    });
  });
});
