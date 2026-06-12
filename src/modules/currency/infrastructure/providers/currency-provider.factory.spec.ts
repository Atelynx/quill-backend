import { CurrencyProviderFactory } from './currency-provider.factory';
import { FallbackCurrencyDataProvider } from './fallback-currency-data.provider';

describe('CurrencyProviderFactory', () => {
  const mockProvider = { getName: () => 'mock' };
  const exchangeRateProvider = { getName: () => 'exchangeRate' };
  const noneProvider = { getName: () => 'none' };

  it('creates mock provider', () => {
    const result = CurrencyProviderFactory.createProvider(
      'mock',
      mockProvider as never,
      exchangeRateProvider as never,
      noneProvider as never,
    );
    expect(result.getName()).toBe('mock');
  });

  it('creates FallbackCurrencyDataProvider wrapping exchangeRate+mock when "exchangeRate" is requested', () => {
    const result = CurrencyProviderFactory.createProvider(
      'exchangeRate',
      mockProvider as never,
      exchangeRateProvider as never,
      noneProvider as never,
    );
    expect(result).toBeInstanceOf(FallbackCurrencyDataProvider);
    expect(result.getName()).toBe('exchangeRate_with_fallback_to_mock');
  });

  it('creates none provider for "none"', () => {
    const result = CurrencyProviderFactory.createProvider(
      'none',
      mockProvider as never,
      exchangeRateProvider as never,
      noneProvider as never,
    );
    expect(result.getName()).toBe('none');
  });

  it('creates none provider for empty string', () => {
    const result = CurrencyProviderFactory.createProvider(
      '',
      mockProvider as never,
      exchangeRateProvider as never,
      noneProvider as never,
    );
    expect(result.getName()).toBe('none');
  });

  it('creates none provider for undefined', () => {
    const result = CurrencyProviderFactory.createProvider(
      undefined,
      mockProvider as never,
      exchangeRateProvider as never,
      noneProvider as never,
    );
    expect(result.getName()).toBe('none');
  });

  it('trims provider name before matching', () => {
    const result = CurrencyProviderFactory.createProvider(
      '  mock  ',
      mockProvider as never,
      exchangeRateProvider as never,
      noneProvider as never,
    );
    expect(result.getName()).toBe('mock');
  });

  it('throws for unknown provider', () => {
    expect(() =>
      CurrencyProviderFactory.createProvider(
        'unknown',
        mockProvider as never,
        exchangeRateProvider as never,
        noneProvider as never,
      ),
    ).toThrow(/Unknown currency provider/);
  });
});
