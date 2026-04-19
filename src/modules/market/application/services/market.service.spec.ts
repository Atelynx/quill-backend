import { NotFoundException } from '@nestjs/common';
import { MarketService } from './market.service';

describe('MarketService', () => {
  let service: MarketService;
  let stockModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    estimatedDocumentCount: jest.Mock;
    insertMany: jest.Mock;
    bulkWrite: jest.Mock;
  };
  let snapshotModel: {
    find: jest.Mock;
    insertMany: jest.Mock;
  };
  let provider: {
    getQuote: jest.Mock;
    generateNextPrice?: jest.Mock;
  };
  let cacheService: {
    set: jest.Mock;
  };
  let marketGateway: {
    emitQuotes: jest.Mock;
  };

  beforeEach(() => {
    stockModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      estimatedDocumentCount: jest.fn(),
      insertMany: jest.fn(),
      bulkWrite: jest.fn(),
    };
    snapshotModel = {
      find: jest.fn(),
      insertMany: jest.fn(),
    };
    provider = {
      getQuote: jest.fn(),
    };
    cacheService = {
      set: jest.fn(),
    };
    marketGateway = {
      emitQuotes: jest.fn(),
    };

    service = new MarketService(
      stockModel as never,
      snapshotModel as never,
      provider as never,
      cacheService as never,
      marketGateway as never,
    );
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

  describe('refreshMarket()', () => {
    it('should call provider.getQuote() for each stock', async () => {
      const stocks = [
        {
          _id: '1',
          symbol: 'COPEC',
          previousClose: 100,
          currentPrice: 105,
        },
      ];

      stockModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(stocks),
      });

      provider.getQuote.mockResolvedValue({
        symbol: 'COPEC',
        price: 110,
        previousClose: 100,
      });

      stockModel.bulkWrite.mockResolvedValue({});
      snapshotModel.insertMany.mockResolvedValue([]);

      const exec = jest.fn().mockResolvedValue([]);
      const lean = jest.fn().mockReturnValue({ exec });
      const sort = jest.fn().mockReturnValue({ lean });
      stockModel.find.mockReturnValue({ sort, exec: jest.fn().mockResolvedValue(stocks) });

      await service.refreshMarket();

      expect(provider.getQuote).toHaveBeenCalledWith('COPEC');
    });

    it('should update stock with quote price', async () => {
      const stocks = [
        {
          _id: '1',
          symbol: 'AAPL',
          previousClose: 170,
          currentPrice: 172,
        },
      ];

      stockModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(stocks),
      });

      provider.getQuote.mockResolvedValue({
        symbol: 'AAPL',
        price: 175,
        previousClose: 170,
      });

      stockModel.bulkWrite.mockResolvedValue({});
      snapshotModel.insertMany.mockResolvedValue([]);

      const exec = jest.fn().mockResolvedValue([]);
      const lean = jest.fn().mockReturnValue({ exec });
      const sort = jest.fn().mockReturnValue({ lean });
      stockModel.find.mockReturnValue({ sort, exec: jest.fn().mockResolvedValue(stocks) });

      await service.refreshMarket();

      expect(stockModel.bulkWrite).toHaveBeenCalled();
      const updateCall = stockModel.bulkWrite.mock.calls[0][0][0];
      expect(updateCall.updateOne.update.$set.currentPrice).toBe(175);
    });
  });
});
