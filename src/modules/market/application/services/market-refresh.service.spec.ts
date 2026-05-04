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
  let mockProvider: any;
  let snapshotService: any;
  let updateWriter: any;
  let service: MarketRefreshService;

  beforeEach(() => {
    stockModel = { find: jest.fn() };
    provider = { getName: jest.fn(() => 'EODHD'), getQuote: jest.fn() };
    mockProvider = {
      getQuote: jest.fn().mockResolvedValue(quote(95, 'mock')),
    };
    snapshotService = {
      getLatestMap: jest.fn(),
      quoteFromSnapshot: jest.fn((targetStock, snapshot) =>
        quote(snapshot.price, snapshot.source, targetStock),
      ),
    };
    updateWriter = { persist: jest.fn().mockResolvedValue(undefined) };

    service = new MarketRefreshService(
      stockModel,
      provider,
      mockProvider,
      snapshotService,
      updateWriter,
      { emitQuotes: jest.fn() } as never,
    );
  });

  it('no llama a EODHD si ya hay snapshot actualizado del dia', async () => {
    mockStocks();
    snapshotService.getLatestMap
      .mockResolvedValueOnce(new Map([['COPEC.SN', snapshot(110, 'eodhd')]]))
      .mockResolvedValueOnce(new Map());

    await service.refreshMarket({ allowExternalFetch: true });

    expect(provider.getQuote).not.toHaveBeenCalled();
    expect(updateWriter.persist.mock.calls[0][0][0]).toMatchObject({
      save: false,
      quote: expect.objectContaining({ price: 110 }),
    });
  });

  it('usa ultimo snapshot si EODHD falla', async () => {
    mockStocks();
    snapshotService.getLatestMap
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([['COPEC.SN', snapshot(102, 'eodhd')]]));
    provider.getQuote.mockRejectedValue(new Error('timeout'));

    await service.refreshMarket({ allowExternalFetch: true });

    expect(mockProvider.getQuote).not.toHaveBeenCalled();
    expect(updateWriter.persist.mock.calls[0][0][0].quote.price).toBe(102);
  });

  it('usa mock si EODHD falla y no hay snapshot', async () => {
    mockStocks();
    snapshotService.getLatestMap
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map());
    provider.getQuote.mockRejectedValue(new Error('timeout'));

    await service.refreshMarket({ allowExternalFetch: true });

    expect(mockProvider.getQuote).toHaveBeenCalledWith('COPEC.SN');
    expect(updateWriter.persist.mock.calls[0][0][0].quote.price).toBe(95);
  });

  it('marca snapshot para guardar cuando EODHD responde correctamente', async () => {
    mockStocks();
    snapshotService.getLatestMap
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map());
    provider.getQuote.mockResolvedValue(quote(120, 'eodhd'));

    await service.refreshMarket({ allowExternalFetch: true });

    expect(updateWriter.persist.mock.calls[0][0][0]).toMatchObject({
      save: true,
      quote: expect.objectContaining({ price: 120, source: 'eodhd' }),
    });
  });

  it('no llama a EODHD en refresh operativo sin permiso externo', async () => {
    mockStocks();
    snapshotService.getLatestMap
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map());

    await service.refreshMarket();

    expect(provider.getQuote).not.toHaveBeenCalled();
    expect(mockProvider.getQuote).toHaveBeenCalledWith('COPEC.SN');
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

  function snapshot(price: number, source: string) {
    return { symbol: 'COPEC.SN', price, source, createdAt: new Date() };
  }

  function quote(price: number, source: string, targetStock = stock) {
    return {
      symbol: targetStock.symbol,
      name: targetStock.name,
      price,
      currency: 'CLP',
      timestamp: new Date(),
      exchange: source.toUpperCase(),
      source,
    };
  }
});
