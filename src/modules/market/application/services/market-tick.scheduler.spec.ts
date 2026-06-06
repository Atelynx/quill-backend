import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MarketTickService } from './market-tick.service';
import { MarketTickScheduler } from './market-tick.scheduler';
import { Logger } from '@nestjs/common';

jest.useFakeTimers();

describe('MarketTickScheduler', () => {
  let scheduler: MarketTickScheduler;
  let configService: { get: jest.Mock };
  let marketTickService: { processTick: jest.Mock };
  let schedulerRegistry: {
    addInterval: jest.Mock;
    deleteInterval: jest.Mock;
    doesExist: jest.Mock;
  };

  beforeEach(() => {
    Logger.overrideLogger(false);
    configService = { get: jest.fn() };
    marketTickService = { processTick: jest.fn().mockResolvedValue(undefined) };
    schedulerRegistry = {
      addInterval: jest.fn(),
      deleteInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
    };

    scheduler = new MarketTickScheduler(
      configService as unknown as ConfigService,
      marketTickService as unknown as MarketTickService,
      schedulerRegistry as unknown as SchedulerRegistry,
    );
  });

  afterEach(() => {
    scheduler.onModuleDestroy();
    jest.clearAllTimers();
  });

  describe('onModuleInit', () => {
    it('registers interval when interval > 0', () => {
      configService.get.mockReturnValue(10);

      scheduler.onModuleInit();

      expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
        'market-tick',
        expect.any(Object),
      );
    });

    it('skips registration when interval <= 0', () => {
      configService.get.mockReturnValue(0);

      scheduler.onModuleInit();

      expect(schedulerRegistry.addInterval).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('deletes interval if it exists', () => {
      schedulerRegistry.doesExist.mockReturnValue(true);
      scheduler.onModuleDestroy();
      expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
        'market-tick',
      );
    });

    it('does nothing if interval does not exist', () => {
      schedulerRegistry.doesExist.mockReturnValue(false);
      scheduler.onModuleDestroy();
      expect(schedulerRegistry.deleteInterval).not.toHaveBeenCalled();
    });
  });

  describe('runTick', () => {
    it('delegates to marketTickService.processTick', async () => {
      await (scheduler as any).runTick();
      expect(marketTickService.processTick).toHaveBeenCalled();
    });

    it('logs error when processTick throws', async () => {
      marketTickService.processTick.mockRejectedValue(new Error('tick error'));
      const errorSpy = jest.spyOn((scheduler as any).logger, 'error');

      await (scheduler as any).runTick();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('tick error'),
      );
    });
  });
});
