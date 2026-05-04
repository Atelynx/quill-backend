import { ProviderFactory } from './provider.factory';
import { EodhdMarketDataProvider } from './eodhd-market-data.provider';
import { MockMarketDataProvider } from './mock-market-data.provider';

describe('ProviderFactory', () => {
  let mockProvider: MockMarketDataProvider;
  let eodhdProvider: EodhdMarketDataProvider;

  beforeEach(() => {
    mockProvider = new MockMarketDataProvider();
    eodhdProvider = { getName: () => 'EODHD' } as EodhdMarketDataProvider;
  });

  it('should create MockMarketDataProvider when "mock" is requested', () => {
    const provider = ProviderFactory.createProvider(
      'mock',
      mockProvider,
      eodhdProvider,
    );

    expect(provider).toBe(mockProvider);
    expect(provider.getName()).toBe('Mock');
  });

  it('should throw error for invalid provider name', () => {
    expect(() =>
      ProviderFactory.createProvider('invalid', mockProvider, eodhdProvider),
    ).toThrow('Unknown market provider');
  });

  it('should create EodhdMarketDataProvider when "eodhd" is requested', () => {
    const provider = ProviderFactory.createProvider(
      'eodhd',
      mockProvider,
      eodhdProvider,
    );

    expect(provider).toBe(eodhdProvider);
    expect(provider.getName()).toBe('EODHD');
  });

  it('should be case-insensitive for provider names', () => {
    const provider1 = ProviderFactory.createProvider(
      'MOCK',
      mockProvider,
      eodhdProvider,
    );
    const provider2 = ProviderFactory.createProvider(
      'MoCk',
      mockProvider,
      eodhdProvider,
    );

    expect(provider1).toBe(mockProvider);
    expect(provider2).toBe(mockProvider);
  });
});

