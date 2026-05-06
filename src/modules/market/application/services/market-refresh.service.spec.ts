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
  let snapshotService: any;
  let updateWriter: any;
  let marketGateway: any;
  let service: MarketRefreshService;

  beforeEach(() => {
    stockModel = { find: jest.fn() };
    provider = { getName: jest.fn(() => 'EODHD'), getQuote: jest.fn() };
    snapshotService = {
      getLatestMap: jest.fn(),
      quoteFromSnapshot: jest.fn((targetStock, snapshot) =>
        quote(snapshot.price, snapshot.source, targetStock),
      ),
    };
    updateWriter = { persist: jest.fn().mockResolvedValue(undefined) };
    marketGateway = { emitQuotes: jest.fn() };

    service = new MarketRefreshService(
      stockModel,
      provider,
      snapshotService,
      updateWriter,
      marketGateway,
    );
  });

  it('no llama a API si ya hay snapshot actualizado del dia', async () => {
    mockStocks();
    snapshotService.getLatestMap
      .mockResolvedValueOnce(new Map([['COPEC.SN', snapshot(110, 'eodhd')]]));

    await service.refreshMarket();

    expect(provider.getQuote).not.toHaveBeenCalled();
    expect(updateWriter.persist.mock.calls[0][0][0]).toMatchObject({
      save: false,
      quote: expect.objectContaining({ price: 110 }),
    });
  });

  it('llama a API si no hay snapshot de hoy y guarda resultado', async () => {
    mockStocks();
    snapshotService.getLatestMap
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([['COPEC.SN', snapshot(102, 'eodhd')]]));
    provider.getQuote.mockResolvedValue(quote(120, 'eodhd'));

    await service.refreshMarket();

    expect(provider.getQuote).toHaveBeenCalledWith('COPEC.SN');
    expect(updateWriter.persist.mock.calls[0][0][0]).toMatchObject({
      save: true,
      quote: expect.objectContaining({ price: 120, source: 'eodhd' }),
    });
  });

  it('usa ultimo snapshot si API falla y no hay snapshot de hoy', async () => {
    mockStocks();
    snapshotService.getLatestMap
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([['COPEC.SN', snapshot(102, 'eodhd')]]));
    provider.getQuote.mockRejectedValue(new Error('timeout'));

    await service.refreshMarket();

    expect(updateWriter.persist.mock.calls[0][0][0].quote.price).toBe(102);
  });

  it('registra advertencia si API falla y no hay ningun snapshot', async () => {
    mockStocks();
    snapshotService.getLatestMap
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map());
    provider.getQuote.mockRejectedValue(new Error('timeout'));

    await service.refreshMarket();

    expect(updateWriter.persist.mock.calls[0][0]).toEqual([]);
  });

  it('retorna array vacio si no hay acciones en BD', async () => {
    stockModel.find.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });

    const result = await service.refreshMarket();

    expect(result).toEqual([]);
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
