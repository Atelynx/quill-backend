import { CurrencyStrategyResolver } from './currency-strategy.resolver';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { StrategyFactory } from '../../../common/strategies/strategy.factory';

describe('CurrencyStrategyResolver', () => {
  let adminConfigService: { get: jest.Mock };
  let gbmStrategy: { getName: jest.Mock };
  let flatStrategy: { getName: jest.Mock };
  let nwStrategy: { getName: jest.Mock };
  let resolver: CurrencyStrategyResolver;

  beforeEach(() => {
    adminConfigService = { get: jest.fn() };
    gbmStrategy = { getName: jest.fn().mockReturnValue('GBM') };
    flatStrategy = { getName: jest.fn().mockReturnValue('Flat') };
    nwStrategy = { getName: jest.fn().mockReturnValue('NoiseWave') };

    resolver = new CurrencyStrategyResolver(
      adminConfigService as never,
      gbmStrategy as never,
      flatStrategy as never,
      nwStrategy as never,
    );
  });

  it('returns flat strategy when CURRENCY_SIMULATION_STRATEGY is "flat"', async () => {
    adminConfigService.get.mockResolvedValue('flat');
    const strategy = await resolver.getStrategy();
    expect(strategy).toBe(flatStrategy);
  });

  it('returns gbm strategy when CURRENCY_SIMULATION_STRATEGY is "gbm"', async () => {
    adminConfigService.get.mockResolvedValue('gbm');
    const strategy = await resolver.getStrategy();
    expect(strategy).toBe(gbmStrategy);
  });

  it('returns nw strategy when CURRENCY_SIMULATION_STRATEGY is "nw"', async () => {
    adminConfigService.get.mockResolvedValue('nw');
    const strategy = await resolver.getStrategy();
    expect(strategy).toBe(nwStrategy);
  });

  it('falls back to flat when config is null', async () => {
    adminConfigService.get.mockResolvedValue(null);
    const strategy = await resolver.getStrategy();
    expect(strategy).toBe(flatStrategy);
  });

  it('caches strategy and returns same instance on repeated calls', async () => {
    adminConfigService.get.mockResolvedValue('nw');
    const first = await resolver.getStrategy();
    const second = await resolver.getStrategy();
    expect(first).toBe(second);
  });

  it('invalidates cache when config key changes', async () => {
    adminConfigService.get
      .mockResolvedValueOnce('flat')
      .mockResolvedValueOnce('gbm');

    const flatResult = await resolver.getStrategy();
    expect(flatResult).toBe(flatStrategy);

    const gbmResult = await resolver.getStrategy();
    expect(gbmResult).toBe(gbmStrategy);
  });

  it('throws when factory throws for invalid key', async () => {
    adminConfigService.get.mockResolvedValue('invalid');
    await expect(resolver.getStrategy()).rejects.toThrow('Unknown strategy');
  });
});
