import { Logger } from '@nestjs/common';
import { PRICE_UPDATE_EVENT } from '../../domain/constants/events';
import { MarketRefreshService } from './market-refresh.service';

interface MarketRefreshInternals {
  logger: Logger;
  errorMessage(error: unknown): string;
}

interface ProviderMock {
  getName: jest.Mock;
  getQuote: jest.Mock;
  getQuotes?: jest.Mock;
}

describe('MarketRefreshService', () => {
  const stock = {
    _id: '1',
    symbol: 'COPEC.SN',
    name: 'COPEC',
    currency: 'CLP',
    previousClose: 100,
    close: 100,
  };
  let stockModel: { find: jest.Mock };
  let provider: ProviderMock;
  let updateWriter: { persist: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: MarketRefreshService;
  let internals: MarketRefreshInternals;

  beforeEach(() => {
    stockModel = { find: jest.fn() };
    provider = {
      getName: jest.fn(() => 'Mock'),
      getQuote: jest.fn(),
      getQuotes: jest.fn(),
    };
    updateWriter = { persist: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };

    service = new MarketRefreshService(
      stockModel as never,
      provider as never,
      updateWriter as never,
      eventEmitter as never,
    );
    internals = service as unknown as MarketRefreshInternals;
  });
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it('calls provider.getQuotes() and persists results', async () => {
    mockStocks();
    const apiQuote = quote(120, 'mock');
    provider.getQuotes?.mockResolvedValue([apiQuote]);

    await service.refreshMarket();

    expect(provider.getQuotes).toHaveBeenCalledWith(['COPEC.SN']);
    const persistCalls = updateWriter.persist.mock.calls as unknown as Array<
      [[{ quote: { price: number }; save: boolean }], string]
    >;
    expect(persistCalls[0][0][0].quote.price).toBe(120);
    expect(persistCalls[0][0][0].save).toBe(true);
    expect(persistCalls[0][1]).toBe('mock');
  });

  it('falls back to getQuote() when provider has no getQuotes()', async () => {
    mockStocks();
    provider.getQuotes = undefined;
    provider.getQuote.mockResolvedValue(quote(115, 'mock'));

    await service.refreshMarket();

    expect(provider.getQuote).toHaveBeenCalledWith('COPEC.SN');
    expect(updateWriter.persist).toHaveBeenCalled();
  });

  it('returns empty array if no stocks in database', async () => {
    stockModel.find.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue([]),
    });

    const result = await service.refreshMarket();

    expect(result).toEqual([]);
    expect(provider.getQuote).not.toHaveBeenCalled();
    expect(provider.getQuotes).not.toHaveBeenCalled();
  });

  it('skips refresh if already in progress', async () => {
    mockStocks();
    // Make the provider call slow enough that the second call overlaps
    provider.getQuotes?.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve([quote(120, 'mock')]), 100),
        ),
    );

    const warnSpy = jest.spyOn(internals.logger, 'warn');

    // Fire first call in background
    const promise1 = service.refreshMarket();
    // Fire second call immediately — should be skipped
    const result2 = await service.refreshMarket();

    expect(result2).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      'Refresh already in progress, skipping.',
    );

    // Await the first call to clean up
    await promise1;
  });

  it('emits price update event after refresh', async () => {
    mockStocks();
    provider.getQuotes?.mockResolvedValue([quote(120, 'mock')]);

    await service.refreshMarket();

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PRICE_UPDATE_EVENT,
      expect.any(Array),
    );
  });

  describe('fallback per-symbol fetch (getQuote fallback path)', () => {
    it('logs per-symbol errors without breaking the batch', async () => {
      mockStocks();
      provider.getQuotes = undefined;
      provider.getQuote
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockResolvedValueOnce(quote(115, 'mock'));

      const errorSpy = jest.spyOn(internals.logger, 'error');

      const results = await service.refreshMarket();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not update COPEC.SN'),
      );
      expect(results).toHaveLength(1);
    });

    it('errorMessage returns "unknown error" for non-Error input', () => {
      const result = internals.errorMessage('string error');
      expect(result).toBe('unknown error');
    });
  });

  function mockStocks(): void {
    stockModel.find
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([stock]) })
      .mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([stock]),
          }),
        }),
      });
  }

  function quote(price: number, source: string) {
    return {
      symbol: stock.symbol,
      name: stock.name,
      price,
      currency: 'CLP',
      timestamp: new Date(),
      exchange: source.toUpperCase(),
      source,
    };
  }
});
