import { ConfigService } from '@nestjs/config';
import { MarketSeedService } from './market-seed.service';
import { Logger } from '@nestjs/common';

describe('MarketSeedService', () => {
  let service: MarketSeedService;
  let stockModel: { find: jest.Mock; insertMany: jest.Mock };
  let snapshotModel: { insertMany: jest.Mock };
  let provider: { getName: jest.Mock; getSeedData: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    stockModel = {
      find: jest.fn(),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    snapshotModel = {
      insertMany: jest.fn().mockResolvedValue([]),
    };
    provider = {
      getName: jest.fn().mockReturnValue('mock'),
      getSeedData: jest.fn(),
    };
    configService = { get: jest.fn() };
    const resolver = { getProvider: jest.fn().mockResolvedValue(provider) };

    service = new MarketSeedService(
      stockModel as never,
      snapshotModel as never,
      resolver as never,
      configService as unknown as ConfigService,
    );
  });
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  describe('seedInitialStocks', () => {
    it('returns early when no seed data resolved', async () => {
      provider.getSeedData.mockReturnValue([]);

      await service.seedInitialStocks();

      expect(stockModel.find).not.toHaveBeenCalled();
      expect(stockModel.insertMany).not.toHaveBeenCalled();
    });

    it('inserts missing stocks that do not exist in DB', async () => {
      provider.getSeedData.mockReturnValue([
        { symbol: 'AAPL', name: 'Apple', currency: 'USD', close: 150 },
        { symbol: 'GOOGL', name: 'Alphabet', currency: 'USD', close: 2800 },
      ]);
      stockModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([{ symbol: 'AAPL' }]),
          }),
        }),
      });

      await service.seedInitialStocks();

      expect(stockModel.insertMany).toHaveBeenCalledWith([
        expect.objectContaining({ symbol: 'GOOGL' }),
      ]);
    });

    it('does not insert any stocks when all already exist', async () => {
      provider.getSeedData.mockReturnValue([
        { symbol: 'AAPL', name: 'Apple', currency: 'USD', close: 150 },
      ]);
      stockModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([{ symbol: 'AAPL' }]),
          }),
        }),
      });

      await service.seedInitialStocks();

      expect(stockModel.insertMany).not.toHaveBeenCalled();
    });

    it('generates historical snapshots for mock provider', async () => {
      provider.getSeedData.mockReturnValue([
        { symbol: 'AAPL', name: 'Apple', currency: 'USD', close: 150 },
      ]);
      stockModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.seedInitialStocks();

      expect(snapshotModel.insertMany).toHaveBeenCalled();
      const snapshots = snapshotModel.insertMany.mock.calls[0][0];
      expect(snapshots).toHaveLength(24);
      expect(snapshots[0]).toMatchObject({
        symbol: 'AAPL',
        source: 'mock',
      });
      expect(typeof snapshots[0].price).toBe('number');
    });

    it('logs placeholder message for non-mock provider', async () => {
      provider.getName.mockReturnValue('eodhd');
      provider.getSeedData.mockReturnValue([
        { symbol: 'AAPL', name: 'Apple', currency: 'USD', close: 150 },
      ]);
      stockModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.seedInitialStocks();

      expect(snapshotModel.insertMany).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Placeholder records created'),
      );
    });
  });

  describe('resolveSeedStocks', () => {
    it('returns provider seed data when available', () => {
      provider.getSeedData.mockReturnValue([{ symbol: 'TEST', close: 100 }]);
      const result = (service as any).resolveSeedStocks(provider);
      expect(result).toEqual([{ symbol: 'TEST', close: 100 }]);
    });

    it('returns empty array when provider returns empty array', () => {
      provider.getSeedData.mockReturnValue([]);
      const result = (service as any).resolveSeedStocks(provider);
      expect(result).toEqual([]);
    });

    it('falls back to hardcoded seed stocks when provider has no getSeedData', () => {
      provider.getSeedData.mockReturnValue(undefined);
      const result = (service as any).resolveSeedStocks(provider);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('symbol');
    });
  });

  describe('prepareSeedDocuments', () => {
    it('normalizes stock documents with defaults', () => {
      const docs = (service as any).prepareSeedDocuments(provider, [
        { symbol: 'AAPL', name: 'Apple', currency: 'USD', close: 150 },
      ]);
      expect(docs[0]).toMatchObject({
        symbol: 'AAPL',
        name: 'Apple',
        currency: 'USD',
        close: 150,
        previousClose: 0,
        dayChangePercentage: 0,
        source: 'mock',
      });
    });
  });
});
