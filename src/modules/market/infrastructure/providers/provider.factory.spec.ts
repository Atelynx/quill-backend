import { ProviderFactory } from './provider.factory';
import { MockMarketDataProvider } from './mock-market-data.provider';

describe('ProviderFactory', () => {
  let mockProvider: MockMarketDataProvider;

  beforeEach(() => {
    mockProvider = new MockMarketDataProvider();
  });

  it('should create MockMarketDataProvider when "mock" is requested', () => {
    const provider = ProviderFactory.createProvider('mock', mockProvider);

    expect(provider).toBe(mockProvider);
    expect(provider.getName()).toBe('Mock');
  });

  it('should throw error for invalid provider name', () => {
    expect(() =>
      ProviderFactory.createProvider('invalid', mockProvider),
    ).toThrow('Unknown market provider');
  });

  it('should be case-insensitive for provider names', () => {
    const provider1 = ProviderFactory.createProvider('MOCK', mockProvider);
    const provider2 = ProviderFactory.createProvider('MoCk', mockProvider);

    expect(provider1).toBe(mockProvider);
    expect(provider2).toBe(mockProvider);
  });
});

