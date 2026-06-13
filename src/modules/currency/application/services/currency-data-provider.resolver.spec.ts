import { CurrencyDataProviderResolver } from './currency-data-provider.resolver';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { CurrencyProviderFactory } from '../../infrastructure/providers/currency-provider.factory';

describe('CurrencyDataProviderResolver', () => {
  let adminConfigService: { get: jest.Mock };
  let mockProvider: { getName: jest.Mock };
  let exchangeRateProvider: { getName: jest.Mock };
  let noneProvider: { getName: jest.Mock };
  let resolver: CurrencyDataProviderResolver;

  beforeEach(() => {
    adminConfigService = { get: jest.fn() };
    mockProvider = { getName: jest.fn().mockReturnValue('mock') };
    exchangeRateProvider = { getName: jest.fn().mockReturnValue('exchangeRate') };
    noneProvider = { getName: jest.fn().mockReturnValue('none') };

    resolver = new CurrencyDataProviderResolver(
      adminConfigService as never,
      mockProvider as never,
      exchangeRateProvider as never,
      noneProvider as never,
    );
  });

  it('returns mock provider when CURRENCY_PROVIDER is "mock"', async () => {
    adminConfigService.get.mockResolvedValue('mock');
    const provider = await resolver.getProvider();
    expect(provider).toBe(mockProvider);
  });

  it('returns exchangeRate fallback provider when CURRENCY_PROVIDER is "exchangeRate"', async () => {
    adminConfigService.get.mockResolvedValue('exchangeRate');
    const provider = await resolver.getProvider();
    expect(provider.getName()).toBe('exchangeRate_with_fallback_to_mock');
  });

  it('returns none provider when CURRENCY_PROVIDER is "none"', async () => {
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
    await expect(resolver.getProvider()).rejects.toThrow('Unknown currency provider');
  });
});
