import { NotFoundException } from '@nestjs/common';
import { MarketService } from './market.service';

describe('MarketService', () => {
  let service: MarketService;
  let stockModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    estimatedDocumentCount: jest.Mock;
    insertMany: jest.Mock;
  };
  let snapshotModel: {
    find: jest.Mock;
    insertMany: jest.Mock;
  };
  let provider: {
    generateNextPrice: jest.Mock;
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
    };
    snapshotModel = {
      find: jest.fn(),
      insertMany: jest.fn(),
    };
    provider = {
      generateNextPrice: jest.fn(),
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
});
