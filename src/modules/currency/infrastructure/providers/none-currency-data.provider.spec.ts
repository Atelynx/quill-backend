import { NoneCurrencyDataProvider } from './none-currency-data.provider';

describe('NoneCurrencyDataProvider', () => {
  let provider: NoneCurrencyDataProvider;

  beforeEach(() => {
    provider = new NoneCurrencyDataProvider();
  });

  it('getName returns none', () => {
    expect(provider.getName()).toBe('none');
  });

  it('getSymbols returns empty array', () => {
    expect(provider.getSymbols()).toEqual([]);
  });

  it('getQuote throws with clear error message', async () => {
    await expect(provider.getQuote('USDCLP')).rejects.toThrow(
      'No currency provider configured for USDCLP',
    );
  });
});
