import { MarketDataProviderResolver } from './market-data-provider.resolver';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { MarketDataProviderFactory } from '../../infrastructure/providers/market-data-provider.factory';

describe('MarketDataProviderResolver', () => {
  let adminConfigService: { get: jest.Mock };
  let mockProvider: { getName: jest.Mock };
  let eodhdProvider: { getName: jest.Mock };
  let noneProvider: { getName: jest.Mock };
  let resolver: MarketDataProviderResolver;

  beforeEach(() => {
    adminConfigService = { get: jest.fn() };
    mockProvider = { getName: jest.fn().mockReturnValue('Mock') };
    eodhdProvider = { getName: jest.fn().mockReturnValue('EODHD') };
    noneProvider = { getName: jest.fn().mockReturnValue('none') };

    resolver = new MarketDataProviderResolver(
      adminConfigService as never,
      mockProvider as never,
      eodhdProvider as never,
      noneProvider as never,
    );
  });

  it('returns mock provider when MARKET_PROVIDER is "mock"', async () => {
    adminConfigService.get.mockResolvedValue('mock');
    const provider = await resolver.getProvider();
    expect(provider).toBe(mockProvider);
  });

  it('returns eodhd fallback provider when MARKET_PROVIDER is "eodhd"', async () => {
    adminConfigService.get.mockResolvedValue('eodhd');
    const provider = await resolver.getProvider();
    expect(provider.getName()).toBe('EODHD_with_fallback_to_Mock');
  });

  it('returns none provider when MARKET_PROVIDER is "none"', async () => {
    adminConfigService.get.mockResolvedValue('none');
    const provider = await resolver.getProvider();
    expect(provider).toBe(noneProvider);
  });

  it('falls back to mock when config is null', async () => {
    adminConfigService.get.mockResolvedValue(null);
    const provider = await resolver.getProvider();
    expect(provider).toBe(mockProvider);
  });

  it('caches provider and returns same instance on repeated calls', async () => {
    adminConfigService.get.mockResolvedValue('mock');
    const first = await resolver.getProvider();
    const second = await resolver.getProvider();
    expect(first).toBe(second);
  });

  it('invalidates cache when config key changes', async () => {
    adminConfigService.get
      .mockResolvedValueOnce('mock')
      .mockResolvedValueOnce('none');

    const mockResult = await resolver.getProvider();
    expect(mockResult).toBe(mockProvider);

    const noneResult = await resolver.getProvider();
    expect(noneResult).toBe(noneProvider);
  });

  it('throws when factory throws for invalid key', async () => {
    adminConfigService.get.mockResolvedValue('invalid');
    await expect(resolver.getProvider()).rejects.toThrow('Unknown market provider');
  });
});
