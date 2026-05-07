import { MarketRefreshService } from './market-refresh.service';

describe('MarketRefreshService', () => {
  const stock = {
    _id: '1',
    symbol: 'COPEC.SN',
    name: 'COPEC',
    currency: 'CLP',
    previousClose: 100,
    currentPrice: 100,
  };
  let stockModel: any;
  let provider: any;
  let updateWriter: any;
  let marketGateway: any;
  let service: MarketRefreshService;

  beforeEach(() => {
    stockModel = { find: jest.fn() };
    provider = {
      getName: jest.fn(() => 'Mock'),
      getQuote: jest.fn(),
      getQuotes: jest.fn(),
    };
    updateWriter = { persist: jest.fn().mockResolvedValue(undefined) };
    marketGateway = { emitQuotes: jest.fn() };

    service = new MarketRefreshService(
      stockModel,
      provider,
      updateWriter,
      marketGateway,
    );
  });

  it('calls provider.getQuotes() and persists results', async () => {
    mockStocks();
    const apiQuote = quote(120, 'mock');
    provider.getQuotes.mockResolvedValue([apiQuote]);

    await service.refreshMarket();

    expect(provider.getQuotes).toHaveBeenCalledWith(['COPEC.SN']);
    expect(updateWriter.persist).toHaveBeenCalledWith(
      [expect.objectContaining({ quote: expect.objectContaining({ price: 120 }), save: true })],
      'mock',
    );
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
    stockModel.find.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

    const result = await service.refreshMarket();

    expect(result).toEqual([]);
    expect(provider.getQuote).not.toHaveBeenCalled();
    expect(provider.getQuotes).not.toHaveBeenCalled();
  });

  it('skips refresh if already in progress', async () => {
    mockStocks();
    // Make the provider call slow enough that the second call overlaps
    provider.getQuotes.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([quote(120, 'mock')]), 100)),
    );

    const warnSpy = jest.spyOn((service as any).logger, 'warn');

    // Fire first call in background
    const promise1 = service.refreshMarket();
    // Fire second call immediately — should be skipped
    const result2 = await service.refreshMarket();

    expect(result2).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('Refresh already in progress, skipping.');

    // Await the first call to clean up
    await promise1;
  });

  it('emits quotes via WebSocket after refresh', async () => {
    mockStocks();
    provider.getQuotes.mockResolvedValue([quote(120, 'mock')]);

    await service.refreshMarket();

    expect(marketGateway.emitQuotes).toHaveBeenCalled();
  });

  function mockStocks() {
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
