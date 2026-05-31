import { NoneMarketDataProvider } from './none-market-data.provider';

describe('NoneMarketDataProvider', () => {
  let provider: NoneMarketDataProvider;

  beforeEach(() => {
    provider = new NoneMarketDataProvider();
  });

  it('getName returns none', () => {
    expect(provider.getName()).toBe('none');
  });

  it('getQuote throws descriptive error', async () => {
    await expect(provider.getQuote('AAPL')).rejects.toThrow(
      'No hay datos configurados para AAPL',
    );
  });
});
