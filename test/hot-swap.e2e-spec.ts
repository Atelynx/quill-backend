import type { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  destroyTestApp,
  type TestAppContext,
} from './support/test-app';
import { AdminConfigService } from '../src/modules/admin/application/services/admin-config.service';
import { MarketDataProviderResolver } from '../src/modules/market/application/services/market-data-provider.resolver';
import { NoneMarketDataProvider } from '../src/modules/market/infrastructure/providers/none-market-data.provider';
import { MockMarketDataProvider } from '../src/modules/market/infrastructure/providers/mock-market-data.provider';

describe('Hot-swappable providers (e2e)', () => {
  let testContext: TestAppContext | undefined;

  jest.setTimeout(120000);

  afterEach(async () => {
    if (testContext) {
      await destroyTestApp(testContext);
      testContext = undefined;
    }
  });

  it('switches from mock to none and back to mock at runtime', async () => {
    testContext = await createTestApp();

    const adminConfigService = testContext.app.get(AdminConfigService);
    const resolver = testContext.app.get(MarketDataProviderResolver);

    // Start with mock
    await adminConfigService.set('MARKET_PROVIDER', 'mock');
    const mockProvider = await resolver.getProvider();
    expect(mockProvider).toBeInstanceOf(MockMarketDataProvider);

    // Switch to none
    await adminConfigService.set('MARKET_PROVIDER', 'none');
    const noneProvider = await resolver.getProvider();
    expect(noneProvider).toBeInstanceOf(NoneMarketDataProvider);

    // Switch back to mock
    await adminConfigService.set('MARKET_PROVIDER', 'mock');
    const mockProviderAgain = await resolver.getProvider();
    expect(mockProviderAgain).toBeInstanceOf(MockMarketDataProvider);
  });
});
