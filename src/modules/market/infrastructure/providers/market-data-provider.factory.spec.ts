import { MarketDataProviderFactory } from './market-data-provider.factory';
import { EodhdMarketDataProvider } from './eodhd-market-data.provider';
import { MockMarketDataProvider } from './mock-market-data.provider';
import { NoneMarketDataProvider } from './none-market-data.provider';
import { FallbackMarketDataProvider } from './fallback-market-data.provider';
import { ConfigService } from '@nestjs/config';

describe('ProviderFactory', () => {
  let mockProvider: MockMarketDataProvider;
  let eodhdProvider: EodhdMarketDataProvider;
  let noneProvider: NoneMarketDataProvider;
  let configService: ConfigService;
  let stockModel: { find: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as ConfigService;
    stockModel = { find: jest.fn() };

    mockProvider = new MockMarketDataProvider(
      configService,
      stockModel as never,
    );

    eodhdProvider = { getName: () => 'EODHD' } as EodhdMarketDataProvider;
    noneProvider = new NoneMarketDataProvider();
  });

  it('should create MockMarketDataProvider when "mock" is requested', () => {
    const provider = MarketDataProviderFactory.createProvider(
      'mock',
      mockProvider,
      eodhdProvider,
      noneProvider,
    );

    expect(provider).toBe(mockProvider);
    expect(provider.getName()).toBe('Mock');
  });

  it('should create NoneMarketDataProvider when provider is empty', () => {
    const provider = MarketDataProviderFactory.createProvider(
      '',
      mockProvider,
      eodhdProvider,
      noneProvider,
    );

    expect(provider).toBe(noneProvider);
    expect(provider.getName()).toBe('none');
  });

  it('should create NoneMarketDataProvider when provider is undefined', () => {
    const provider = MarketDataProviderFactory.createProvider(
      undefined,
      mockProvider,
      eodhdProvider,
      noneProvider,
    );

    expect(provider).toBe(noneProvider);
    expect(provider.getName()).toBe('none');
  });

  it('should throw error for invalid provider name', () => {
    expect(() =>
      MarketDataProviderFactory.createProvider(
        'invalid',
        mockProvider,
        eodhdProvider,
        noneProvider,
      ),
    ).toThrow('Unknown market provider');
  });

  it('should create FallbackMarketDataProvider wrapping eodhd+mock when "eodhd" is requested', () => {
    const provider = MarketDataProviderFactory.createProvider(
      'eodhd',
      mockProvider,
      eodhdProvider,
      noneProvider,
    );

    expect(provider).toBeInstanceOf(FallbackMarketDataProvider);
    expect(provider.getName()).toBe('EODHD_with_fallback_to_Mock');
  });

  it('should be case-insensitive for provider names', () => {
    const provider1 = MarketDataProviderFactory.createProvider(
      'MOCK',
      mockProvider,
      eodhdProvider,
      noneProvider,
    );
    const provider2 = MarketDataProviderFactory.createProvider(
      'MoCk',
      mockProvider,
      eodhdProvider,
      noneProvider,
    );

    expect(provider1).toBe(mockProvider);
    expect(provider2).toBe(mockProvider);
  });
});
