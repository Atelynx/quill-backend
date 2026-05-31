import { NotFoundException } from '@nestjs/common';
import { MarketService } from './market.service';

describe('MarketService', () => {
  let service: MarketService;
  let stockModel: {
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let snapshotModel: {
    find: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };
  let marketRefreshService: {
    refreshMarket: jest.Mock;
  };
  let marketSeedService: {
    seedInitialStocks: jest.Mock;
  };

  beforeEach(() => {
    stockModel = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    snapshotModel = {
      find: jest.fn(),
    };
    configService = { get: jest.fn() };
    marketRefreshService = { refreshMarket: jest.fn() };
    marketSeedService = { seedInitialStocks: jest.fn() };

    service = new MarketService(
      stockModel as never,
      snapshotModel as never,
      configService as never,
      marketRefreshService as never,
      marketSeedService as never,
    );
  });

  describe('onModuleInit', () => {
    it('seeds and refreshes when MARKET_FETCH_ON_STARTUP is true', async () => {
      configService.get.mockReturnValue(true);

      await service.onModuleInit();

      expect(marketSeedService.seedInitialStocks).toHaveBeenCalled();
      expect(marketRefreshService.refreshMarket).toHaveBeenCalled();
    });

    it('seeds but does not refresh when MARKET_FETCH_ON_STARTUP is false', async () => {
      configService.get.mockReturnValue(false);

      await service.onModuleInit();

      expect(marketSeedService.seedInitialStocks).toHaveBeenCalled();
      expect(marketRefreshService.refreshMarket).not.toHaveBeenCalled();
    });
  });

  it('lista cotizaciones ordenadas por simbolo', async () => {
    const exec = jest.fn().mockResolvedValue([{ symbol: 'AAPL' }]);
    const lean = jest.fn().mockReturnValue({ exec });
    const sort = jest.fn().mockReturnValue({ lean });
    stockModel.find.mockReturnValue({ sort });

    const result = await service.listQuotes();

    expect(sort).toHaveBeenCalledWith({ symbol: 1 });
    expect(result).toEqual([{ symbol: 'AAPL' }]);
  });

  it('obtiene el historial de precios en orden cronologico', async () => {
    const stockExec = jest.fn().mockResolvedValue({ symbol: 'AAPL' });
    const stockLean = jest.fn().mockReturnValue({ exec: stockExec });
    stockModel.findOne.mockReturnValue({ lean: stockLean });

    const snapshotExec = jest.fn().mockResolvedValue([
      { price: 103, createdAt: new Date('2026-01-03') },
      { price: 102, createdAt: new Date('2026-01-02') },
      { price: 101, createdAt: new Date('2026-01-01') },
    ]);
    const snapshotLean = jest.fn().mockReturnValue({ exec: snapshotExec });
    const limit = jest.fn().mockReturnValue({ lean: snapshotLean });
    const sort = jest.fn().mockReturnValue({ limit });
    snapshotModel.find.mockReturnValue({ sort });

    const result = await service.getPriceHistory('aapl', 3);

    expect(stockModel.findOne).toHaveBeenCalledWith({ symbol: 'AAPL' });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(3);
    expect(result).toEqual([
      { price: 101, createdAt: new Date('2026-01-01') },
      { price: 102, createdAt: new Date('2026-01-02') },
      { price: 103, createdAt: new Date('2026-01-03') },
    ]);
  });

  it('lanza error si la accion no existe', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const lean = jest.fn().mockReturnValue({ exec });
    stockModel.findOne.mockReturnValue({ lean });

    await expect(service.getQuote('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('getTopMovers', () => {
    it('returns stocks sorted by dayChangePercentage with limit', async () => {
      const exec = jest.fn().mockResolvedValue([
        { symbol: 'AAPL', dayChangePercentage: 5 },
        { symbol: 'MSFT', dayChangePercentage: 3 },
      ]);
      const lean = jest.fn().mockReturnValue({ exec });
      const limit = jest.fn().mockReturnValue({ lean });
      const sort = jest.fn().mockReturnValue({ limit });
      stockModel.find.mockReturnValue({ sort });

      const result = await service.getTopMovers(2);

      expect(sort).toHaveBeenCalledWith({ dayChangePercentage: -1 });
      expect(limit).toHaveBeenCalledWith(2);
      expect(result).toHaveLength(2);
    });
  });

  it('delega el refresh de mercado al servicio especializado', async () => {
    marketRefreshService.refreshMarket.mockResolvedValue([{ symbol: 'COPEC' }]);

    const result = await service.refreshMarket();

    expect(marketRefreshService.refreshMarket).toHaveBeenCalledWith();
    expect(result).toEqual([{ symbol: 'COPEC' }]);
  });
});
