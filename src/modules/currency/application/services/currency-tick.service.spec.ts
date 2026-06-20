import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CURRENCY_UPDATE_EVENT } from '../../domain/constants/events';
import { CurrencyTickService } from './currency-tick.service';
import Decimal from 'decimal.js';

jest.useFakeTimers();
import { Logger } from '@nestjs/common';

interface CurrencyTickServiceInternals {
  isTicking: boolean;
  processTick(): Promise<void>;
}

describe('CurrencyTickService', () => {
  let service: CurrencyTickService;
  let internals: CurrencyTickServiceInternals;
  let setIntervalSpy: jest.SpyInstance;
  let provider: { getSymbols: jest.Mock };
  let strategy: { calculateNextTick: jest.Mock };
  let cacheService: { get: jest.Mock; set: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let configService: { get: jest.Mock };
  let schedulerRegistry: {
    addInterval: jest.Mock;
    deleteInterval: jest.Mock;
    doesExist: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    provider = { getSymbols: jest.fn() };
    strategy = { calculateNextTick: jest.fn() };
    cacheService = { get: jest.fn(), set: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    configService = { get: jest.fn() };
    schedulerRegistry = {
      addInterval: jest.fn(),
      deleteInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
    };

    service = new CurrencyTickService(
      provider as never,
      strategy as never,
      cacheService as never,
      eventEmitter as unknown as EventEmitter2,
      configService as unknown as ConfigService,
      schedulerRegistry as unknown as SchedulerRegistry,
    );
    internals = service as unknown as CurrencyTickServiceInternals;
    // Prevent real intervals from being created during tests
    setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation(() => {
        // return a dummy timer object that won't keep node alive
        return { ref: () => {}, unref: () => {} } as unknown as NodeJS.Timeout;
      });
  });
  beforeAll(() => {
    Logger.overrideLogger(false);
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
    service.onModuleDestroy?.();
    setIntervalSpy?.mockRestore?.();
  });
  describe('onModuleInit', () => {
    it('registers interval when interval > 0 and symbols exist', () => {
      provider.getSymbols.mockReturnValue(['EURUSD']);
      configService.get.mockReturnValue(5);

      service.onModuleInit();

      expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
        'currency-tick',
        expect.any(Object),
      );
    });

    it('does not register interval when interval <= 0', () => {
      provider.getSymbols.mockReturnValue(['EURUSD']);
      configService.get.mockReturnValue(0);

      service.onModuleInit();

      expect(schedulerRegistry.addInterval).not.toHaveBeenCalled();
    });

    it('does not register interval when no symbols', () => {
      provider.getSymbols.mockReturnValue([]);
      configService.get.mockReturnValue(5);

      service.onModuleInit();

      expect(schedulerRegistry.addInterval).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('deletes interval if it exists', () => {
      schedulerRegistry.doesExist.mockReturnValue(true);
      service.onModuleDestroy();
      expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
        'currency-tick',
      );
    });

    it('does nothing if interval does not exist', () => {
      schedulerRegistry.doesExist.mockReturnValue(false);
      service.onModuleDestroy();
      expect(schedulerRegistry.deleteInterval).not.toHaveBeenCalled();
    });
  });

  describe('processTick', () => {
    beforeEach(() => {
      provider.getSymbols.mockReturnValue(['EURUSD', 'GBPUSD']);
      configService.get.mockReturnValue(5);
    });

    it('skips when already ticking (concurrent guard)', async () => {
      internals.isTicking = true;
      await internals.processTick();
      expect(provider.getSymbols).not.toHaveBeenCalled();
    });

    it('calculates next price and emits event', async () => {
      cacheService.get
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(102)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(205);
      strategy.calculateNextTick
        .mockReturnValueOnce(new Decimal(104))
        .mockReturnValueOnce(new Decimal(210));

      await internals.processTick();

      expect(strategy.calculateNextTick).toHaveBeenCalledTimes(2);
      expect(cacheService.set).toHaveBeenNthCalledWith(
        1,
        'forex:EURUSD:live_price',
        104,
        60_000,
      );
      expect(cacheService.set).toHaveBeenNthCalledWith(
        2,
        'forex:GBPUSD:live_price',
        210,
        60_000,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(CURRENCY_UPDATE_EVENT, [
        expect.objectContaining({ symbol: 'EURUSD', close: 104 }),
        expect.objectContaining({ symbol: 'GBPUSD', close: 210 }),
      ]);
    });

    it('skips symbols with missing base or live price', async () => {
      cacheService.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(102)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(null);

      await internals.processTick();

      expect(strategy.calculateNextTick).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('resets isTicking in finally block', async () => {
      cacheService.get.mockResolvedValueOnce(100).mockResolvedValueOnce(102);
      strategy.calculateNextTick.mockReturnValue(new Decimal(104));

      await internals.processTick();

      expect(internals.isTicking).toBe(false);
    });

    it('does not emit when no updates', async () => {
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await internals.processTick();

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
