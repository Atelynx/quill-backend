import { SchedulerRegistry } from '@nestjs/schedule';
import { MarketRefreshScheduler } from './market-refresh.scheduler';
import { Logger } from '@nestjs/common';

jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

describe('MarketRefreshScheduler', () => {
  let scheduler: MarketRefreshScheduler;
  let provider: { getName: jest.Mock; getRefreshSchedule: jest.Mock };
  let marketRefreshService: { refreshMarket: jest.Mock };
  let schedulerRegistry: {
    addCronJob: jest.Mock;
    deleteCronJob: jest.Mock;
    doesExist: jest.Mock;
  };

  beforeEach(() => {

    provider = {
      getName: jest.fn().mockReturnValue('TestProvider'),
      getRefreshSchedule: jest.fn(),
    };
    marketRefreshService = { refreshMarket: jest.fn().mockResolvedValue(undefined) };
    schedulerRegistry = {
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
    };

    scheduler = new MarketRefreshScheduler(
      provider as never,
      marketRefreshService as never,
      schedulerRegistry as unknown as SchedulerRegistry,
    );
  });
  beforeAll(()=>{
    Logger.overrideLogger(false);
  })
  afterEach(() => {
    scheduler.onModuleDestroy();
  })

  describe('onModuleInit', () => {
    it('registers cron job when provider declares a schedule', () => {
      provider.getRefreshSchedule.mockReturnValue({ cronExpression: '0 0 * * *' });

      scheduler.onModuleInit();

      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        'market-refresh',
        expect.any(Object),
      );
    });

    it('skips cron registration when provider has no schedule', () => {
      provider.getRefreshSchedule.mockReturnValue(undefined);

      scheduler.onModuleInit();

      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('deletes the cron job if it exists', () => {
      schedulerRegistry.doesExist.mockReturnValue(true);
      scheduler.onModuleDestroy();
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith('market-refresh');
    });

    it('does nothing if cron job does not exist', () => {
      schedulerRegistry.doesExist.mockReturnValue(false);
      scheduler.onModuleDestroy();
      expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalled();
    });
  });

  describe('runRefresh', () => {
    it('delegates to marketRefreshService.refreshMarket', async () => {
      await (scheduler as any).runRefresh();
      expect(marketRefreshService.refreshMarket).toHaveBeenCalled();
    });

    it('logs error when refreshMarket throws', async () => {
      marketRefreshService.refreshMarket.mockRejectedValue(new Error('network error'));
      const errorSpy = jest.spyOn((scheduler as any).logger, 'error');

      await (scheduler as any).runRefresh();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('network error'),
      );
    });
  });
});
